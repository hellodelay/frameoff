import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoFrame } from './components/PhotoFrame';
import { ControlsOverlay } from './components/ControlsOverlay';
import { AlbumPickerModal } from './components/AlbumPickerModal';
import { SettingsModal } from './components/SettingsModal';
import { HomePage } from './components/HomePage';
import { Album, AuthUser, CachedPhoto, FrameSettings, SyncState } from './types';
import * as db from './services/db';
import { wakeLockService } from './services/wakeLock';
import {
  clearAllAuthAndCredentials,
  fetchGoogleAlbums,
  getCachedAuthUser,
  getEffectiveClientId,
  initGoogleTokenClient,
  isTokenValid,
  requestLogin,
  saveCachedAuthUser,
  syncAlbumToCache,
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
  const loadPhotosForAlbum = async (albumId: string) => {
    const cached = await db.getPhotosByAlbum(albumId);
    if (cached.length > 0) {
      setPhotos(cached);
      setCurrentIndex(0);
      setTimeRemainingSeconds(settings.transitionSpeed);
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

  // Google OAuth Login (switchUser: true prompts account chooser)
  const handleConnectGoogle = (switchUser: boolean = false) => {
    const effectiveClientId = settings.googleClientId || getEffectiveClientId();
    if (!effectiveClientId) {
      setShowSettingsModal(true);
      return;
    }

    try {
      tokenClientRef.current = initGoogleTokenClient(
        effectiveClientId,
        async (user) => {
          setAuthUser(user);
          // Fetch user's albums
          try {
            const fetchedAlbums = await fetchGoogleAlbums(user.accessToken);
            if (fetchedAlbums.length > 0) {
              // Merge with sample album
              const merged = [SAMPLE_ALBUM, ...fetchedAlbums];
              setAlbums(merged);
              for (const a of fetchedAlbums) {
                await db.saveAlbum(a);
              }
              // Open album picker to let user choose their album
              setShowAlbumModal(true);
            }
          } catch (err) {
            console.warn('Failed to load Google Photos albums:', err);
          }
        },
        (err) => {
          alert(`Google Sign-In Note: ${err}\n\nPlease verify your Google OAuth Client ID in Settings.`);
        }
      );

      if (tokenClientRef.current) {
        requestLogin(tokenClientRef.current, switchUser ? 'select_account' : false);
      }
    } catch (err: any) {
      alert(`Could not start Google Sign In: ${err.message}`);
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

      // Check if token is expired and refresh silently if possible
      if (!album.isSampleAlbum && (!authUser || !isTokenValid(authUser))) {
        const effectiveClientId = settings.googleClientId || getEffectiveClientId();
        if (effectiveClientId && tokenClientRef.current) {
          // Silent refresh
          requestLogin(tokenClientRef.current, true);
        }
      }

      const result = await syncAlbumToCache(album, token, (curr, total, name) => {
        setSyncProgressText(`Caching ${curr}/${total}...`);
      });

      // Update current photos if this album is active
      if (currentAlbum?.id === album.id) {
        await loadPhotosForAlbum(album.id);
      }

      // Update album in state
      const updatedAlbums = await db.getAlbums();
      if (!updatedAlbums.some((a) => a.id === SAMPLE_ALBUM.id)) {
        updatedAlbums.unshift(SAMPLE_ALBUM);
      }
      setAlbums(updatedAlbums);

      setSyncState('success');
      setSyncProgressText(`Synced! ${result.added} new photos cached.`);
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

  const handleRefreshAlbums = async () => {
    if (!authUser) return;
    try {
      const liveAlbums = await fetchGoogleAlbums(authUser.accessToken);
      const merged = [SAMPLE_ALBUM, ...liveAlbums];
      setAlbums(merged);
      for (const a of liveAlbums) {
        await db.saveAlbum(a);
      }
    } catch (err) {
      console.warn('Error refreshing albums:', err);
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
