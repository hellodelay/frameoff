import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoFrame } from './components/PhotoFrame';
import { ControlsOverlay } from './components/ControlsOverlay';
import { AlbumPickerModal } from './components/AlbumPickerModal';
import { SettingsModal } from './components/SettingsModal';
import { HomePage } from './components/HomePage';
import { SharedAlbumModal } from './components/SharedAlbumModal';
import { Album, AuthUser, CachedPhoto, FrameSettings, SyncState } from './types';
import * as db from './services/db';
import { wakeLockService } from './services/wakeLock';
import {
  clearAllAuthAndCredentials,
  createPickerSession,
  deletePickerSession,
  ensureFreshAuthToken,
  fetchGoogleAlbums,
  getCachedAuthUser,
  getEffectiveClientId,
  getPickerSession,
  hasPickerScope,
  importLocalPhotos,
  importPickerPhotos,
  importSharedLinkAlbum,
  initGoogleTokenClient,
  isTokenValid,
  listPickerMediaItems,
  requestAuthTokenInteractive,
  requestLogin,
  requestLoginWithConsent,
  requestSilentAuthToken,
  saveCachedAuthUser,
  syncAlbumToCache,
  waitForGoogleSdk,
} from './services/googlePhotos';
import { SAMPLE_ALBUM, SAMPLE_PHOTOS_RAW } from './services/sampleData';

const DEFAULT_SETTINGS: FrameSettings = {
  transitionSpeed: 8,
  transitionEffect: 'kenburns',
  fitMode: 'fit-blur',
  keepScreenOn: true,
  shuffle: false,
  showClock: true,
  showPhotoInfo: true,
  syncIntervalMinutes: 30,
  googleClientId: '',
  autoPlay: true,
};

export default function App() {
  // Navigation View State ('home' or 'frame')
  const [currentView, setCurrentView] = useState<'home' | 'frame'>('frame');

  // Slideshow State
  const [photos, setPhotos] = useState<CachedPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(DEFAULT_SETTINGS.transitionSpeed);

  // Settings & Storage State
  const [settings, setSettings] = useState<FrameSettings>(DEFAULT_SETTINGS);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [albums, setAlbums] = useState<Album[]>([SAMPLE_ALBUM]);
  const [storageStats, setStorageStats] = useState<{ totalCount: number; totalBytes: number }>({
    totalCount: 0,
    totalBytes: 0,
  });

  // Auth & Sync State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncProgressText, setSyncProgressText] = useState<string>('');
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // UI Modal State
  const [controlsVisible, setControlsVisible] = useState<boolean>(false);
  const [showAlbumModal, setShowAlbumModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showSharedAlbumModal, setShowSharedAlbumModal] = useState<boolean>(false);
  const [isImportingSharedAlbum, setIsImportingSharedAlbum] = useState<boolean>(false);
  const [sharedImportProgressText, setSharedImportProgressText] = useState<string>('');
  const [isPickingGooglePhotos, setIsPickingGooglePhotos] = useState<boolean>(false);
  const [albumFetchError, setAlbumFetchError] = useState<string | null>(null);

  // Refs for timers
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenClientRef = useRef<any>(null);
  const isSyncingRef = useRef<boolean>(false);

  // 1. Initial boot: load settings, wake lock, cached auth, stored albums
  useEffect(() => {
    const initApp = async () => {
      // Online/offline listeners
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Subscribe to wake lock state
      const unsubscribeWake = wakeLockService.subscribe((active) => {
        setIsWakeLockActive(active);
      });

      // Load saved settings from IndexedDB
      try {
        const savedSettings = await db.getSettings();
        if (savedSettings) {
          setSettings(savedSettings);
          if (savedSettings.keepScreenOn) {
            wakeLockService.enable();
          }
        } else {
          // Default keep screen on
          wakeLockService.enable();
        }
      } catch (err) {
        console.warn('Failed to load settings:', err);
      }

      // Check cached Google auth
      const cachedUser = getCachedAuthUser();
      if (cachedUser) {
        setAuthUser(cachedUser);

        // Proactively refresh the token silently in background so user doesn't have to re-login
        if (cachedUser.email) {
          waitForGoogleSdk(12000).then(async (sdkReady) => {
            if (!sdkReady) return;
            try {
              const savedSet = await db.getSettings();
              const cid = savedSet?.googleClientId || getEffectiveClientId();
              if (cid) {
                console.log('[Auth Init] Silently renewing cached session for:', cachedUser.email);
                const fresh = await requestSilentAuthToken(cid, cachedUser.email);
                setAuthUser(fresh);
                console.log('[Auth Init] Session silently refreshed, valid until:', new Date(fresh.expiresAt).toLocaleTimeString());
              }
            } catch (err) {
              console.log('[Auth Init] Background token renewal will run on user action:', err);
            }
          });
        }
      }

      // Check storage stats
      let initialStats = { totalCount: 0, totalBytes: 0 };
      try {
        initialStats = await db.getStorageStats();
        setStorageStats(initialStats);
      } catch (e) {
        console.warn('Failed to get storage stats', e);
      }

      const hasAuth = !!cachedUser;
      const hasCachedPhotos = initialStats.totalCount > 0;

      // Load albums from IndexedDB
      try {
        const storedAlbums = await db.getAlbums();
        if (storedAlbums.length > 0) {
          // Ensure sample album is in list
          if (!storedAlbums.some((a) => a.id === SAMPLE_ALBUM.id)) {
            storedAlbums.unshift(SAMPLE_ALBUM);
          }
          setAlbums(storedAlbums);
          const firstAlbum = storedAlbums[0];
          setCurrentAlbum(firstAlbum);
          if (hasCachedPhotos) {
            await loadPhotosForAlbum(firstAlbum.id);
          }
        } else {
          // Register sample album metadata
          await db.saveAlbum(SAMPLE_ALBUM);
          setAlbums([SAMPLE_ALBUM]);
          setCurrentAlbum(SAMPLE_ALBUM);
        }
      } catch (err) {
        console.warn('Error loading albums from DB:', err);
      }

      // If no google photos auth data and no photo cache, show homepage
      if (!hasAuth && !hasCachedPhotos) {
        setCurrentView('home');
      } else {
        setCurrentView('frame');
      }

      // Refresh storage stats
      refreshStorageStats();

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        unsubscribeWake();
      };
    };

    initApp();
  }, []);

  // Update wake lock when settings change
  useEffect(() => {
    if (settings.keepScreenOn) {
      wakeLockService.enable();
    } else {
      wakeLockService.disable();
    }
  }, [settings.keepScreenOn]);

  // Proactive background token keepalive: keeps the session alive indefinitely
  useEffect(() => {
    const effectiveClientId = settings.googleClientId || getEffectiveClientId();
    if (!effectiveClientId || !authUser?.email || !isOnline) return;

    // Check periodically: if token expires in less than 15 minutes, silently refresh
    const checkAndRefresh = async () => {
      const needsRefresh = !authUser.expiresAt || Date.now() > authUser.expiresAt - 15 * 60 * 1000;
      if (needsRefresh) {
        try {
          console.log('[Auth Keepalive] Proactively renewing session in background for:', authUser.email);
          const fresh = await requestSilentAuthToken(effectiveClientId, authUser.email);
          setAuthUser(fresh);
          console.log('[Auth Keepalive] Session extended until:', new Date(fresh.expiresAt).toLocaleTimeString());
        } catch (err) {
          console.log('[Auth Keepalive] Silent refresh attempt waiting for next window:', err);
        }
      }
    };

    const interval = setInterval(checkAndRefresh, 4 * 60 * 1000); // check every 4 minutes
    return () => clearInterval(interval);
  }, [authUser?.email, authUser?.expiresAt, settings.googleClientId, isOnline]);

  // Seed sample photos into IndexedDB for offline demo
  const seedSamplePhotos = async (sampleAlbum: Album) => {
    setSyncState('syncing');
    setSyncProgressText('Caching sample album offline...');
    try {
      await syncAlbumToCache(sampleAlbum, undefined, (curr, total, name) => {
        setSyncProgressText(`Caching offline (${curr}/${total})`);
      });
      await loadPhotosForAlbum(sampleAlbum.id);
      setSyncState('success');
    } catch (err) {
      console.warn('Failed to seed sample album:', err);
      setSyncState('idle');
    } finally {
      refreshStorageStats();
      setTimeout(() => setSyncProgressText(''), 2000);
    }
  };

  // Load photos for selected album from IndexedDB
  const loadPhotosForAlbum = async (albumId: string, resetIndex: boolean = true) => {
    const cached = await db.getPhotosByAlbum(albumId);
    if (cached.length > 0) {
      setPhotos(cached);
      if (resetIndex) {
        setCurrentIndex(0);
        setTimeRemainingSeconds(settings.transitionSpeed);
      }
    } else {
      setPhotos([]);
    }
  };

  // Storage stats updater
  const refreshStorageStats = async () => {
    try {
      const stats = await db.getStorageStats();
      setStorageStats(stats);
    } catch (e) {
      console.warn('Failed to get storage stats', e);
    }
  };

  // Update settings and save to DB
  const handleUpdateSettings = async (newSettings: Partial<FrameSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await db.saveSettings(updated);
  };

  // Auto-hide controls overlay after 4 seconds of inactivity
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4500);
  }, []);

  const handleTapScreen = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      showControlsTemporarily();
    }
  };

  // Slideshow Navigation
  const handleNextPhoto = useCallback(() => {
    if (photos.length <= 1) return;
    setDirection(1);
    if (settings.shuffle) {
      let next = Math.floor(Math.random() * photos.length);
      if (next === currentIndex && photos.length > 1) {
        next = (next + 1) % photos.length;
      }
      setCurrentIndex(next);
    } else {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
    setTimeRemainingSeconds(settings.transitionSpeed);
  }, [photos.length, settings.shuffle, currentIndex, settings.transitionSpeed]);

  const handlePrevPhoto = useCallback(() => {
    if (photos.length <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setTimeRemainingSeconds(settings.transitionSpeed);
  }, [photos.length, settings.transitionSpeed]);

  // Slideshow Timer Tick
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleNextPhoto();
          return settings.transitionSpeed;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, photos.length, handleNextPhoto, settings.transitionSpeed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'frame') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextPhoto();
        showControlsTemporarily();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevPhoto();
        showControlsTemporarily();
      } else if (e.key === 'p') {
        setIsPlaying((prev) => !prev);
        showControlsTemporarily();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, handleNextPhoto, handlePrevPhoto, showControlsTemporarily]);

  // Google OAuth Login (switchUser: true prompts account chooser; prompt 'consent' ensures picker scope is granted)
  const handleConnectGoogle = async (switchUser: boolean = false) => {
    const effectiveClientId = settings.googleClientId || getEffectiveClientId();
    if (!effectiveClientId) {
      setShowSettingsModal(true);
      return;
    }

    try {
      const user = await requestLoginWithConsent(
        effectiveClientId,
        switchUser ? 'select_account' : 'consent'
      );
      setAuthUser(user);

      // Fetch user's albums (legacy API check or notify user to use Picker)
      try {
        const result = await fetchGoogleAlbums(user.accessToken);
        if (result.albums.length > 0) {
          setAlbumFetchError(null);
          const merged = [SAMPLE_ALBUM, ...result.albums];
          setAlbums(merged);
          for (const a of result.albums) {
            await db.saveAlbum(a);
          }
          setShowAlbumModal(true);
        } else {
          setAlbumFetchError(
            result.error ||
              'Google now restricts third-party access to the full albums list. Please use the "Pick from Google Photos" button to select photos or albums directly.'
          );
          setShowAlbumModal(true);
        }
      } catch (err: any) {
        console.warn('Failed to load Google Photos albums:', err);
        setAlbumFetchError(
          'Google Photos direct album listing is restricted by Google. Click "Pick from Google Photos" to select photos directly.'
        );
        setShowAlbumModal(true);
      }
    } catch (err: any) {
      if (!err.message?.includes('popup_closed_by_user')) {
        alert(`Google Sign-In Note: ${err.message}\n\nPlease verify your Google OAuth Client ID in Settings.`);
      }
    }
  };

  // Google Photos Picker API Workflow
  const handleStartGooglePicker = async (targetAlbum?: Album | null) => {
    const effectiveClientId = settings.googleClientId || getEffectiveClientId();
    if (!effectiveClientId) {
      alert(
        'A Google OAuth Client ID is required to connect to Google Photos. Please enter your Client ID in Settings, or use "Upload Device Photos" to load pictures directly from your device.'
      );
      setShowSettingsModal(true);
      return;
    }

    setIsPickingGooglePhotos(true);
    let token = authUser?.accessToken;

    // 1. Verify token exists and has modern Picker scope
    if (!token || !isTokenValid(authUser) || !hasPickerScope(authUser)) {
      try {
        setSyncProgressText('Requesting Google Photos permission...');
        const refreshedUser = await requestLoginWithConsent(effectiveClientId, 'consent');
        setAuthUser(refreshedUser);
        token = refreshedUser.accessToken;
      } catch (authErr: any) {
        setIsPickingGooglePhotos(false);
        setSyncProgressText('');
        console.warn('OAuth consent error or cancelled:', authErr);
        if (authErr.message && !authErr.message.includes('popup_closed_by_user')) {
          alert(`Google Authentication: ${authErr.message}`);
        }
        return;
      }
    }

    try {
      // 2. Create a Picker session (with auto-upgrade retry if existing token lacked scope)
      let session;
      try {
        session = await createPickerSession(token);
      } catch (sessionErr: any) {
        if (sessionErr.message === 'INSUFFICIENT_SCOPES') {
          // The token in memory lacked the photospicker scope. Prompt user for consent to upgrade scope.
          setSyncProgressText('Updating permissions for Google Photos Picker...');
          const refreshedUser = await requestLoginWithConsent(effectiveClientId, 'consent');
          setAuthUser(refreshedUser);
          token = refreshedUser.accessToken;
          session = await createPickerSession(token);
        } else {
          throw sessionErr;
        }
      }

      if (!session || !session.pickerUri) {
        throw new Error('Unable to create Google Photos picker session.');
      }

      // 3. Open Picker in a popup window
      const pickerPopup = window.open(
        session.pickerUri,
        'GooglePhotosPicker',
        'width=920,height=750,menubar=no,toolbar=no'
      );

      // 4. Poll picker session until user selects photos (mediaItemsSet === true)
      let sessionFinished = false;
      const startTime = Date.now();
      const maxWaitMs = 15 * 60 * 1000; // 15 minutes timeout

      while (!sessionFinished && Date.now() - startTime < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check if window was closed by user
        if (pickerPopup && pickerPopup.closed) {
          // Poll up to 6 times (9 seconds total) to allow Google's servers to register the user's "Done" confirmation
          setSyncProgressText('Finalizing photo selection with Google...');
          for (let retry = 0; retry < 6; retry++) {
            const finalCheck = await getPickerSession(session.id, token);
            if (finalCheck.mediaItemsSet) {
              sessionFinished = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
          break;
        }

        const pollStatus = await getPickerSession(session.id, token);
        if (pollStatus.mediaItemsSet) {
          sessionFinished = true;
          if (pickerPopup && !pickerPopup.closed) {
            pickerPopup.close();
          }
          break;
        }
      }

      if (!sessionFinished) {
        setSyncState('idle');
        setSyncProgressText('');
        alert(
          'Photo Selection Incomplete:\n\nNo photos were confirmed in Google Photos. When using the Google Photos Picker, select your desired photos and click "Done" in the Google window before closing it.'
        );
        return;
      }

      // 5. Retrieve picked media items
      setSyncState('syncing');
      setSyncProgressText('Retrieving selected photos from Google Photos...');
      const pickedItems = await listPickerMediaItems(session.id, token);
      console.log(`[Google Photos Picker] Retrieved ${pickedItems.length} media items`);

      if (pickedItems.length > 0) {
        const isExisting = !!targetAlbum;
        const albumTitle = targetAlbum
          ? targetAlbum.title
          : `Google Photos (${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`;

        setSyncProgressText(
          isExisting
            ? `Adding ${pickedItems.length} photos to "${albumTitle}"...`
            : `Importing ${pickedItems.length} photos from Google Photos...`
        );

        const { album: savedAlbum, addedCount } = await importPickerPhotos(
          pickedItems,
          albumTitle,
          token,
          (curr: number, total: number, name: string) => {
            setSyncProgressText(`Caching offline: ${curr}/${total} photos (${name})...`);
          },
          targetAlbum?.id
        );

        const importedPhotos = await db.getPhotosByAlbum(savedAlbum.id);
        console.log(`[Google Photos Picker] Successfully cached ${importedPhotos.length} photos in album ${savedAlbum.id}`);

        // Update albums state & indexedDB
        const allAlbums = await db.getAlbums();
        if (!allAlbums.some((a) => a.id === SAMPLE_ALBUM.id)) {
          allAlbums.unshift(SAMPLE_ALBUM);
        }
        setAlbums(allAlbums);
        setCurrentAlbum(savedAlbum);

        if (isExisting && currentAlbum?.id === targetAlbum.id && photos.length > 0) {
          // Seamlessly append to active slideshow queue without interrupting current photo
          setPhotos(importedPhotos);
          setSyncProgressText(
            addedCount > 0
              ? `✨ Added ${addedCount} new photo${addedCount === 1 ? '' : 's'} to "${savedAlbum.title}"!`
              : `Album "${savedAlbum.title}" is up to date.`
          );
        } else {
          setPhotos(importedPhotos);
          setCurrentIndex(0);
          setTimeRemainingSeconds(settings.transitionSpeed);
        }

        refreshStorageStats();
        setShowAlbumModal(false);
        setCurrentView('frame');
      } else {
        alert('Google reported 0 photos selected. Please try picking photos again and ensure you click Done.');
      }

      // 6. Clean up session
      try {
        await deletePickerSession(session.id, token);
      } catch {
        // benign
      }
    } catch (err: any) {
      console.error('Picker API error:', err);
      if (err.message === 'INSUFFICIENT_SCOPES') {
        alert(
          'Google Photos Permission Needed:\n\nYour Google account has not granted permission to access Google Photos.\n\nPlease click "Pick from Google Photos" again and make sure to check the box granting photo access on Google\'s consent screen.\n\nAlso make sure "Google Photos Picker API" is enabled in your Google Cloud Console (APIs & Services > Library).'
        );
      } else {
        alert(
          `Google Photos Picker Notice: ${err.message || err}\n\nTip: You can also use the "Upload Device Photos" button to import photos directly from your device into the offline frame without Google cloud setup.`
        );
      }
    } finally {
      setIsPickingGooglePhotos(false);
      setSyncState('idle');
      setSyncProgressText('');
    }
  };

  // Local Photos Import (for direct offline use without Google dependencies)
  const handleImportLocalPhotos = async (files: FileList | File[], customTitle?: string) => {
    if (!files || files.length === 0) return;

    setSyncState('syncing');
    setSyncProgressText(`Importing ${files.length} local photos...`);
    try {
      const newAlbum = await importLocalPhotos(
        files,
        customTitle || `Device Photos (${new Date().toLocaleDateString()})`
      );

      const importedPhotos = await db.getPhotosByAlbum(newAlbum.id);
      const allAlbums = await db.getAlbums();
      setAlbums(allAlbums);
      setCurrentAlbum(newAlbum);
      setPhotos(importedPhotos);
      setCurrentIndex(0);
      refreshStorageStats();
      setShowAlbumModal(false);
      setCurrentView('frame');
    } catch (err: any) {
      console.error('Failed to import local photos:', err);
      alert(`Could not import local photos: ${err.message || err}`);
    } finally {
      setSyncState('idle');
      setSyncProgressText('');
    }
  };

  // Shared Link Album Import (photos.app.goo.gl or photos.google.com/share)
  const handleImportSharedAlbum = async (url: string) => {
    setIsImportingSharedAlbum(true);
    setSharedImportProgressText('Connecting to Google Photos shared album...');
    setSyncState('syncing');
    setSyncProgressText('Importing shared album photos...');

    try {
      const { album, addedCount } = await importSharedLinkAlbum(url, (curr, total, filename) => {
        setSharedImportProgressText(`Downloading photo ${curr} of ${total} (${filename})...`);
        setSyncProgressText(`Caching photos: ${curr}/${total}`);
      });

      const importedPhotos = await db.getPhotosByAlbum(album.id);
      const allAlbums = await db.getAlbums();
      setAlbums(allAlbums);
      setCurrentAlbum(album);
      setPhotos(importedPhotos);
      setCurrentIndex(0);
      setTimeRemainingSeconds(settings.transitionSpeed);
      refreshStorageStats();
      setShowSharedAlbumModal(false);
      setShowAlbumModal(false);
      setCurrentView('frame');
    } catch (err: any) {
      console.error('Failed to import shared album:', err);
      throw err;
    } finally {
      setIsImportingSharedAlbum(false);
      setSharedImportProgressText('');
      setSyncState('idle');
      setSyncProgressText('');
    }
  };

  const handleReturnToFrame = async () => {
    // If photos are already loaded in memory, return directly to frame
    if (photos.length > 0) {
      setCurrentView('frame');
      return;
    }

    // If an album is selected, try loading its photos from cache
    if (currentAlbum) {
      const cached = await db.getPhotosByAlbum(currentAlbum.id);
      if (cached.length > 0) {
        setPhotos(cached);
        setCurrentIndex(0);
        setTimeRemainingSeconds(settings.transitionSpeed);
        setCurrentView('frame');
        return;
      }
    }

    // If no photo data exists, default to loading the demo album
    await handleLoadDemoAlbum();
  };

  const handleClearAllData = async () => {
    try {
      await db.clearAllDatabaseData();
    } catch (err) {
      console.warn('Error clearing IndexedDB:', err);
    }

    clearAllAuthAndCredentials();

    try {
      localStorage.clear();
    } catch (err) {
      console.warn('Error clearing localStorage:', err);
    }

    setPhotos([]);
    setAlbums([]);
    setCurrentAlbum(null);
    setAuthUser(null);
    setSettings(DEFAULT_SETTINGS);
    setStorageStats({ totalCount: 0, totalBytes: 0 });
    setCurrentIndex(0);
    setCurrentView('home');
    setShowSettingsModal(false);
    setShowAlbumModal(false);
  };

  const handleLoadDemoAlbum = async () => {
    setCurrentAlbum(SAMPLE_ALBUM);
    const cached = await db.getPhotosByAlbum(SAMPLE_ALBUM.id);
    if (cached.length > 0) {
      setPhotos(cached);
      setCurrentIndex(0);
      setTimeRemainingSeconds(settings.transitionSpeed);
    } else {
      await seedSamplePhotos(SAMPLE_ALBUM);
    }
    setCurrentView('frame');
  };

  const handleSignOut = () => {
    setAuthUser(null);
    saveCachedAuthUser(null);
  };

  // Album Selection
  const handleSelectAlbum = async (album: Album) => {
    setCurrentAlbum(album);
    await loadPhotosForAlbum(album.id);
    setShowAlbumModal(false);

    // If album has no photos cached yet, trigger background sync
    const cached = await db.getPhotosByAlbum(album.id);
    if (cached.length === 0) {
      handleSyncAlbum(album);
    }
  };

  // Sync Album to Offline Cache
  const handleSyncAlbum = async (album: Album) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncState('syncing');
    setSyncProgressText('Syncing album photos...');

    try {
      let token = authUser?.accessToken;

      // Check if token is expired and refresh silently if possible (only for Google Photos API albums)
      if (!album.isSampleAlbum && !album.isSharedLinkAlbum && !album.isLocalAlbum && (!authUser || !isTokenValid(authUser))) {
        const effectiveClientId = settings.googleClientId || getEffectiveClientId();
        if (effectiveClientId) {
          try {
            const fresh = await ensureFreshAuthToken(effectiveClientId, authUser);
            setAuthUser(fresh);
            token = fresh.accessToken;
          } catch (e) {
            console.log('Sync token refresh note:', e);
          }
        }
      }

      const result = await syncAlbumToCache(album, token, (curr, total, name) => {
        setSyncProgressText(`Caching ${curr}/${total}...`);
      });

      // Update current photos if this album is active
      if (currentAlbum?.id === album.id) {
        await loadPhotosForAlbum(album.id, false);
      }

      // Update album in state
      const updatedAlbums = await db.getAlbums();
      if (!updatedAlbums.some((a) => a.id === SAMPLE_ALBUM.id)) {
        updatedAlbums.unshift(SAMPLE_ALBUM);
      }
      setAlbums(updatedAlbums);

      setSyncState('success');
      if (result.added > 0) {
        setSyncProgressText(`✨ ${result.added} new photo${result.added > 1 ? 's' : ''} added to slideshow!`);
      } else {
        setSyncProgressText('Album is up to date.');
      }
    } catch (err: any) {
      console.warn('Sync failed:', err);
      setSyncState('error');
      setSyncProgressText(err?.message || 'Sync failed');
    } finally {
      isSyncingRef.current = false;
      refreshStorageStats();
      setTimeout(() => {
        setSyncState('idle');
        setSyncProgressText('');
      }, 3500);
    }
  };

  const handleDeleteAlbumCache = async (albumId: string) => {
    await db.deleteAlbum(albumId);
    const updatedAlbums = await db.getAlbums();
    if (!updatedAlbums.some((a) => a.id === SAMPLE_ALBUM.id)) {
      updatedAlbums.unshift(SAMPLE_ALBUM);
    }
    setAlbums(updatedAlbums);
    if (currentAlbum?.id === albumId) {
      setCurrentAlbum(SAMPLE_ALBUM);
      await loadPhotosForAlbum(SAMPLE_ALBUM.id);
    }
    refreshStorageStats();
  };

  const handleRenameAlbum = async (albumId: string, newTitle: string) => {
    const target = albums.find((a) => a.id === albumId);
    if (!target) return;
    const updated = { ...target, title: newTitle };
    await db.saveAlbum(updated);
    const all = await db.getAlbums();
    if (!all.some((a) => a.id === SAMPLE_ALBUM.id)) {
      all.unshift(SAMPLE_ALBUM);
    }
    setAlbums(all);
    if (currentAlbum?.id === albumId) {
      setCurrentAlbum(updated);
    }
  };

  const handleRefreshAlbums = async () => {
    const effectiveClientId = settings.googleClientId || getEffectiveClientId();
    if (!effectiveClientId || !authUser) return;
    try {
      const freshUser = await ensureFreshAuthToken(effectiveClientId, authUser);
      setAuthUser(freshUser);
      const result = await fetchGoogleAlbums(freshUser.accessToken);
      if (result.albums.length > 0) {
        setAlbumFetchError(null);
        const merged = [SAMPLE_ALBUM, ...result.albums];
        setAlbums(merged);
        for (const a of result.albums) {
          await db.saveAlbum(a);
        }
      } else {
        setAlbumFetchError(
          result.error ||
            'Google returned 0 albums via the legacy API. Please use "Pick from Google Photos" to select photos directly.'
        );
      }
    } catch (err) {
      console.warn('Error refreshing albums:', err);
      setAlbumFetchError(
        'Google Photos direct album listing is restricted by Google. Click "Pick from Google Photos" to select photos directly.'
      );
    }
  };

  // Periodic Background Sync (Check for new/changed photos silently)
  useEffect(() => {
    if (!settings.syncIntervalMinutes || settings.syncIntervalMinutes <= 0 || !currentAlbum) {
      return;
    }

    const intervalMs = settings.syncIntervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncingRef.current) {
        handleSyncAlbum(currentAlbum);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [settings.syncIntervalMinutes, currentAlbum, authUser]);

  return (
    <div id="digital-frame-app" className="relative w-screen h-screen overflow-hidden bg-black">
      {currentView === 'home' ? (
        <HomePage
          authUser={authUser}
          onConnectGoogle={handleConnectGoogle}
          onSignOut={handleSignOut}
          hasPhotosAvailable={photos.length > 0 || storageStats.totalCount > 0}
          currentAlbum={currentAlbum}
          photoCount={photos.length}
          onReturnToFrame={handleReturnToFrame}
          onOpenAlbums={() => setShowAlbumModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onClearAllData={handleClearAllData}
          storageStats={storageStats}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          isOnline={isOnline}
          isWakeLockActive={isWakeLockActive}
          onStartGooglePicker={() => handleStartGooglePicker()}
          onOpenSharedAlbumModal={() => setShowSharedAlbumModal(true)}
          onAddPhotosToAlbum={(album) => handleStartGooglePicker(album)}
          onSyncAlbum={handleSyncAlbum}
          onImportLocalPhotos={handleImportLocalPhotos}
          albumFetchError={albumFetchError}
          isPickingGooglePhotos={isPickingGooglePhotos}
        />
      ) : (
        <>
          {/* Primary Photo Canvas */}
          <PhotoFrame
            photos={photos}
            currentIndex={currentIndex}
            direction={direction}
            isPlaying={isPlaying}
            settings={settings}
            onNext={handleNextPhoto}
            onPrev={handlePrevPhoto}
            onTapScreen={handleTapScreen}
          />

          {/* Floating Controls Overlay (Auto-Hides on Inactivity) */}
          <ControlsOverlay
            visible={controlsVisible}
            onDismiss={() => setControlsVisible(false)}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onNext={handleNextPhoto}
            onPrev={handlePrevPhoto}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenAlbums={() => {
              setControlsVisible(false);
              setShowAlbumModal(true);
            }}
            onOpenSettings={() => {
              setControlsVisible(false);
              setShowSettingsModal(true);
            }}
            onGoHome={() => {
              setControlsVisible(false);
              setCurrentView('home');
            }}
            onManualSync={() => currentAlbum && handleSyncAlbum(currentAlbum)}
            onAddPhotos={() => handleStartGooglePicker(currentAlbum)}
            currentAlbum={currentAlbum}
            syncState={syncState}
            syncProgressText={syncProgressText}
            isWakeLockActive={isWakeLockActive}
            isOnline={isOnline}
            timeRemainingSeconds={timeRemainingSeconds}
          />
        </>
      )}

      {/* Album Picker & Offline Cache Manager Modal */}
      <AlbumPickerModal
        isOpen={showAlbumModal}
        onClose={() => setShowAlbumModal(false)}
        albums={albums}
        selectedAlbumId={currentAlbum?.id || null}
        onSelectAlbum={handleSelectAlbum}
        onCacheAlbum={handleSyncAlbum}
        onDeleteAlbumCache={handleDeleteAlbumCache}
        onRefreshAlbums={handleRefreshAlbums}
        authUser={authUser}
        onConnectGoogle={() => {
          setShowAlbumModal(false);
          handleConnectGoogle(false);
        }}
        syncState={syncState}
        storageStats={storageStats}
        onStartGooglePicker={() => handleStartGooglePicker()}
        onOpenSharedAlbumModal={() => {
          setShowAlbumModal(false);
          setShowSharedAlbumModal(true);
        }}
        onAddPhotosToAlbum={(album) => handleStartGooglePicker(album)}
        onImportLocalPhotos={handleImportLocalPhotos}
        onRenameAlbum={handleRenameAlbum}
        albumFetchError={albumFetchError}
        isPickingGooglePhotos={isPickingGooglePhotos}
      />

      {/* Shared Album Link Import Modal */}
      <SharedAlbumModal
        isOpen={showSharedAlbumModal}
        onClose={() => setShowSharedAlbumModal(false)}
        onImportSharedAlbum={handleImportSharedAlbum}
        isImporting={isImportingSharedAlbum}
        importProgressText={sharedImportProgressText}
      />

      {/* Settings Modal (Transitions, Speeds, Screen Wake Lock, Anyone Auth Setup) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        authUser={authUser}
        onSignOut={handleSignOut}
        onConnectGoogle={() => handleConnectGoogle(false)}
        isWakeLockActive={isWakeLockActive}
        onClearAllData={handleClearAllData}
      />
    </div>
  );
}
