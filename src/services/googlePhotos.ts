import { Album, AuthUser, CachedPhoto, GooglePhotoItem } from '../types';
import * as db from './db';
import { SAMPLE_ALBUM, SAMPLE_PHOTOS_RAW } from './sampleData';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            hint?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              scope?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
          };
        };
      };
    };
  }
}

const STORAGE_KEY_AUTH = 'gphotos_auth_user';
const STORAGE_KEY_CLIENT_ID = 'gphotos_custom_client_id';

// Scopes for Google Photos: Modern Picker API, Library API for reading albums & shared albums, and userinfo
export const GOOGLE_PHOTOS_SCOPES = [
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function getEffectiveClientId(): string {
  // Check local storage custom client ID first
  const customId = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
  if (customId && customId.trim().length > 0 && !customId.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return customId.trim();
  }
  // Check environment variable
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (
    envId &&
    envId.trim().length > 0 &&
    !envId.includes('YOUR_GOOGLE_CLIENT_ID') &&
    !envId.includes('your-client-id-here')
  ) {
    return envId.trim();
  }
  return '';
}

export function sanitizeClientId(raw: string): string {
  if (!raw) return '';
  // Remove wrapping quotes, spaces, invisible characters
  let clean = raw.trim().replace(/^["']|["']$/g, '').trim();
  // If user pasted a URL, extract potential query/param or string
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const url = new URL(clean);
      clean = url.searchParams.get('client_id') || clean;
    } catch {
      // ignore
    }
  }
  // Remove any dangerous or invalid characters (Google OAuth client IDs only consist of digits, lowercase/uppercase letters, hyphens, underscores, dots)
  clean = clean.replace(/[^a-zA-Z0-9.\-_]/g, '');
  return clean;
}

export function saveCustomClientId(clientId: string) {
  const sanitized = sanitizeClientId(clientId);
  if (sanitized.length > 0) {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, sanitized);
  } else {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  }
}

export function clearAllAuthAndCredentials() {
  localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  localStorage.removeItem(STORAGE_KEY_AUTH);
  tokenClientInstance = null;
}


export function getCachedAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return null;
    const user: AuthUser = JSON.parse(raw);
    return user;
  } catch (err) {
    return null;
  }
}

export function saveCachedAuthUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_AUTH);
  }
}

export function isTokenValid(user: AuthUser | null): boolean {
  if (!user || !user.accessToken) return false;
  // Give 2 minutes grace period
  return Date.now() < user.expiresAt - 120000;
}

let tokenClientInstance: any = null;

export function initGoogleTokenClient(
  clientId: string,
  onSuccess: (authUser: AuthUser) => void,
  onError: (error: string) => void
) {
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    onError('Google Identity Services SDK is still loading. Please try again in a moment.');
    return null;
  }

  if (!clientId) {
    onError('Google OAuth Client ID is required to sign in.');
    return null;
  }

  tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_PHOTOS_SCOPES,
    callback: async (response) => {
      if (response.error) {
        onError(response.error_description || response.error);
        return;
      }

      if (!response.access_token) {
        onError('No access token received.');
        return;
      }

      const expiresIn = response.expires_in || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      try {
        // Fetch user profile
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        });

        let name = 'Google Photos User';
        let email = '';
        let picture = '';

        if (userInfoRes.ok) {
          const profile = await userInfoRes.json();
          name = profile.name || name;
          email = profile.email || email;
          picture = profile.picture || picture;
        }

        const authUser: AuthUser = {
          name,
          email,
          picture,
          accessToken: response.access_token,
          expiresAt,
          scope: response.scope,
        };

        saveCachedAuthUser(authUser);
        onSuccess(authUser);
      } catch (e: any) {
        // Even if userinfo fails, token is valid for Photos
        const authUser: AuthUser = {
          name: 'Google Photos User',
          email: '',
          picture: '',
          accessToken: response.access_token,
          expiresAt,
          scope: response.scope,
        };
        saveCachedAuthUser(authUser);
        onSuccess(authUser);
      }
    },
  });

  return tokenClientInstance;
}

/**
 * Checks whether the current user has the modern Google Photos Picker scope.
 */
export function hasPickerScope(user: AuthUser | null): boolean {
  if (!user || !user.accessToken) return false;
  // If user has a scope string and it lacks photospicker, return false
  if (user.scope && !user.scope.includes('photospicker.mediaitems.readonly')) {
    return false;
  }
  // If no scope string recorded (from previous session before scope tracking), consider it untrusted
  if (!user.scope) {
    return false;
  }
  return true;
}

export function waitForGoogleSdk(timeoutMs: number = 8000): Promise<boolean> {
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 150);
  });
}

/**
 * Attempts a silent token refresh without opening any popups or consent screens.
 * Leverages Google's existing active user session and granted client authorization.
 */
export async function requestSilentAuthToken(clientId: string, userEmail?: string): Promise<AuthUser> {
  const sdkReady = await waitForGoogleSdk();
  if (!sdkReady) {
    throw new Error('Google Identity Services SDK is not loaded yet.');
  }
  if (!clientId) {
    throw new Error('Google OAuth Client ID is required.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Silent token request timed out.'));
      }
    }, 10000);

    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_PHOTOS_SCOPES,
        hint: userEmail || undefined,
        callback: async (response: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);

          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (!response.access_token) {
            reject(new Error('No access token returned.'));
            return;
          }

          const expiresIn = response.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          const existing = getCachedAuthUser();
          let name = existing?.name || 'Google Photos User';
          let email = existing?.email || userEmail || '';
          let picture = existing?.picture || '';

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (userInfoRes.ok) {
              const profile = await userInfoRes.json();
              name = profile.name || name;
              email = profile.email || email;
              picture = profile.picture || picture;
            }
          } catch {
            // ignore
          }

          const authUser: AuthUser = {
            name,
            email,
            picture,
            accessToken: response.access_token,
            expiresAt,
            scope: response.scope || existing?.scope,
          };

          saveCachedAuthUser(authUser);
          resolve(authUser);
        },
        error_callback: (err: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error(err?.message || 'Silent auth failed'));
        },
      });

      // prompt: '' tells Google to use existing active consent silently without showing any UI
      client.requestAccessToken({ prompt: '', hint: userEmail || undefined });
    } catch (e: any) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    }
  });
}

/**
 * Interactive token request for initial login or when explicit user interaction is needed.
 * By default prompt is '' (empty string), which avoids re-asking for permissions if already granted.
 */
export async function requestAuthTokenInteractive(
  clientId: string,
  options?: {
    prompt?: 'consent' | 'select_account' | '';
    hint?: string;
  }
): Promise<AuthUser> {
  const sdkReady = await waitForGoogleSdk();
  if (!sdkReady) {
    throw new Error('Google Identity Services SDK is not loaded. Please wait a moment and try again.');
  }
  if (!clientId) {
    throw new Error('Google OAuth Client ID is missing. Please configure it in Settings.');
  }

  const promptType = options?.prompt !== undefined ? options.prompt : '';
  const hint = options?.hint;

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_PHOTOS_SCOPES,
        hint: hint || undefined,
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (!response.access_token) {
            reject(new Error('No access token received from Google.'));
            return;
          }

          const expiresIn = response.expires_in || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          const existing = getCachedAuthUser();
          let name = existing?.name || 'Google Photos User';
          let email = existing?.email || hint || '';
          let picture = existing?.picture || '';

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (userInfoRes.ok) {
              const profile = await userInfoRes.json();
              name = profile.name || name;
              email = profile.email || email;
              picture = profile.picture || picture;
            }
          } catch {
            // ignore
          }

          const authUser: AuthUser = {
            name,
            email,
            picture,
            accessToken: response.access_token,
            expiresAt,
            scope: response.scope,
          };

          saveCachedAuthUser(authUser);
          resolve(authUser);
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Authentication failed'));
        },
      });

      const reqConfig: { prompt?: string; hint?: string } = {
        prompt: promptType,
      };
      if (hint) reqConfig.hint = hint;

      client.requestAccessToken(reqConfig);
    } catch (e: any) {
      reject(e);
    }
  });
}

/**
 * Ensures the app has a fresh, valid token for picking photos without prompting the user.
 * 1. Checks if existing token in memory/localStorage is still valid.
 * 2. If expired or missing, tries silent background refresh first.
 * 3. Only falls back to an interactive prompt if silent refresh is not possible.
 */
export async function ensureFreshAuthToken(
  clientId: string,
  currentUser: AuthUser | null,
  forceConsent: boolean = false
): Promise<AuthUser> {
  if (!clientId) {
    throw new Error('Google OAuth Client ID is required. Please configure it in Settings.');
  }

  // 1. If we already have a valid token with proper picker scope and not forcing consent, reuse it!
  if (!forceConsent && currentUser && isTokenValid(currentUser) && hasPickerScope(currentUser)) {
    return currentUser;
  }

  const emailHint = currentUser?.email || getCachedAuthUser()?.email;

  // 2. If not forcing consent, attempt silent background refresh first (zero UI prompt)
  if (!forceConsent && emailHint) {
    try {
      const refreshed = await requestSilentAuthToken(clientId, emailHint);
      if (hasPickerScope(refreshed)) {
        return refreshed;
      }
    } catch (silentErr) {
      console.log('[Auth] Silent token refresh not available, will use interactive prompt:', silentErr);
    }
  }

  // 3. Interactive prompt (prompt: '' by default so already-consented scopes don't prompt again)
  const authUser = await requestAuthTokenInteractive(clientId, {
    prompt: forceConsent ? 'consent' : '',
    hint: emailHint,
  });

  return authUser;
}

/**
 * Backward compatible wrapper for legacy calls.
 */
export function requestLoginWithConsent(
  clientId: string,
  promptType: 'consent' | 'select_account' | '' = ''
): Promise<AuthUser> {
  return requestAuthTokenInteractive(clientId, { prompt: promptType });
}

/**
 * Request access token.
 * option: boolean (true for silent refresh without prompt) or string (e.g. 'select_account' to choose account)
 */
export function requestLogin(tokenClient: any, option?: boolean | string) {
  if (!tokenClient) {
    throw new Error('Token client not initialized');
  }
  if (typeof option === 'boolean') {
    tokenClient.requestAccessToken(option ? { prompt: '' } : undefined);
  } else if (typeof option === 'string' && option.length > 0) {
    tokenClient.requestAccessToken({ prompt: option });
  } else {
    tokenClient.requestAccessToken();
  }
}

// Download image Blob with automatic fallback to proxy for tablets
export async function fetchPhotoBlob(imageUrl: string, accessToken?: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // 1. If accessToken is provided or domain is Google, try proxy endpoint first
  // (Browser cross-origin fetch with custom Authorization header fails on Google CDNs due to CORS)
  if (accessToken || imageUrl.includes('google')) {
    try {
      const proxyUrl = `/api/proxy-photo?url=${encodeURIComponent(imageUrl)}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      if (proxyRes.ok) {
        return await proxyRes.blob();
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  // 2. Try direct fetch
  try {
    const res = await fetch(imageUrl, {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    if (res.ok) {
      return await res.blob();
    }
  } catch (directErr) {
    // Expected on strict CORS, fallback to proxy if not tried yet
  }

  // 3. Try proxy endpoint if not tried yet
  if (!accessToken && !imageUrl.includes('google')) {
    try {
      const proxyUrl = `/api/proxy-photo?url=${encodeURIComponent(imageUrl)}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      if (proxyRes.ok) {
        return await proxyRes.blob();
      }
    } catch {
      // Proxy unavailable (e.g. static hosting like GitHub Pages)
    }
  }

  // 4. Fallback: load image object and draw onto an offscreen canvas (only works for public images)
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1920;
        canvas.height = img.naturalHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas conversion failed'));
          },
          'image/jpeg',
          0.92
        );
      } catch (canvasErr) {
        reject(canvasErr);
      }
    };
    img.onerror = () => reject(new Error(`Could not load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

export interface FetchAlbumsResult {
  albums: Album[];
  error?: string;
  isApiDisabled?: boolean;
}

// Fetch list of albums from Google Photos (Library API)
export async function fetchGoogleAlbums(accessToken: string): Promise<FetchAlbumsResult> {
  const albums: Album[] = [];
  let detectedError: string | undefined = undefined;
  let isApiDisabled = false;

  // 1. Fetch own albums
  try {
    const res = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.albums && Array.isArray(data.albums)) {
        for (const a of data.albums) {
          albums.push({
            id: a.id,
            googleAlbumId: a.id,
            title: a.title || 'Untitled Album',
            coverPhotoBaseUrl: a.coverPhotoBaseUrl,
            mediaItemsCount: a.mediaItemsCount ? Number(a.mediaItemsCount) : undefined,
          });
        }
      }
    } else {
      if (res.status === 401) throw new Error('TOKEN_EXPIRED');
      try {
        const errorJson = await res.json();
        const msg = errorJson.error?.message || res.statusText;
        if (msg.includes('has not been used in project') || msg.includes('disabled')) {
          isApiDisabled = true;
          detectedError =
            'Google Photos API is not enabled in your Google Cloud Console project. Enable it under APIs & Services > Library.';
        } else if (res.status === 403) {
          detectedError =
            'Google Photos Library access was blocked (403). Use "Pick from Google Photos" with the Google Photos Picker API below to select albums or photos.';
        } else {
          detectedError = `Google Photos API error: ${msg}`;
        }
      } catch {
        detectedError = `Google Photos API error (${res.status} ${res.statusText})`;
      }
    }
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') throw err;
    console.warn('Error fetching own albums:', err);
    if (!detectedError) detectedError = err.message;
  }

  // 2. Fetch shared albums
  if (!isApiDisabled) {
    try {
      const resShared = await fetch('https://photoslibrary.googleapis.com/v1/sharedAlbums?pageSize=50', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (resShared.ok) {
        const data = await resShared.json();
        if (data.sharedAlbums && Array.isArray(data.sharedAlbums)) {
          for (const a of data.sharedAlbums) {
            if (!albums.find((existing) => existing.id === a.id)) {
              albums.push({
                id: a.id,
                googleAlbumId: a.id,
                title: `${a.title || 'Shared Album'} (Shared)`,
                coverPhotoBaseUrl: a.coverPhotoBaseUrl,
                mediaItemsCount: a.mediaItemsCount ? Number(a.mediaItemsCount) : undefined,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching shared albums:', err);
    }
  }

  return { albums, error: detectedError, isApiDisabled };
}

// -------------------------------------------------------------
// Modern Google Photos Picker API (Sessions & Media Items)
// -------------------------------------------------------------

export interface PickerSession {
  id: string;
  pickerUri: string;
  expireTime?: string;
  mediaItemsSet?: boolean;
}

export async function createPickerSession(accessToken: string): Promise<PickerSession> {
  const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    let msg = res.statusText;
    try {
      const errData = await res.json();
      msg = errData.error?.message || msg;
    } catch {}

    const lowerMsg = msg.toLowerCase();
    if (
      lowerMsg.includes('insufficient auth scopes') ||
      lowerMsg.includes('scope_insufficient') ||
      lowerMsg.includes('insufficient scope')
    ) {
      throw new Error('INSUFFICIENT_SCOPES');
    }

    if (msg.includes('disabled') || msg.includes('has not been used')) {
      throw new Error(
        'Google Photos Picker API is not enabled. In Google Cloud Console, go to APIs & Services > Library, search for "Google Photos Picker API", and click Enable.'
      );
    }
    throw new Error(`Google Photos Picker error: ${msg}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    pickerUri: data.pickerUri,
    expireTime: data.expireTime,
    mediaItemsSet: data.mediaItemsSet,
  };
}

export async function getPickerSession(sessionId: string, accessToken: string): Promise<PickerSession> {
  const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`Failed to check picker status (${res.status})`);
  }

  const data = await res.json();
  return {
    id: data.id,
    pickerUri: data.pickerUri,
    expireTime: data.expireTime,
    mediaItemsSet: data.mediaItemsSet,
  };
}

export async function listPickerMediaItems(sessionId: string, accessToken: string): Promise<any[]> {
  const allItems: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('TOKEN_EXPIRED');
      const errText = await res.text().catch(() => '');
      console.warn(`[Picker] listPickerMediaItems error ${res.status}:`, errText);
      throw new Error(`Failed to retrieve picked photos (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const items = data.mediaItems || data.items || data.pickedMediaItems || [];
    allItems.push(...items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

export async function deletePickerSession(sessionId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function importPickerPhotos(
  mediaItems: any[],
  albumTitle: string,
  accessToken: string,
  onProgress?: (curr: number, total: number, name: string) => void,
  existingAlbumId?: string
): Promise<{ album: Album; addedCount: number }> {
  if (!mediaItems || mediaItems.length === 0) {
    throw new Error('No photos were selected.');
  }

  const isExisting = !!existingAlbumId;
  const albumId = existingAlbumId || `picker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let firstCoverUrl = '';

  // If adding to an existing album, check existing photo IDs to avoid re-downloading
  const existingPhotos = isExisting ? await db.getPhotosByAlbum(albumId) : [];
  const existingIdSet = new Set(existingPhotos.map((p) => p.id));
  let addedCount = 0;

  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const itemId = item.id || `gphoto_${Date.now()}_${i}`;

    if (existingIdSet.has(itemId)) {
      continue; // Skip photo already in album
    }

    const filename = item.mediaFile?.filename || item.filename || `photo_${i + 1}.jpg`;
    const baseUrl = item.mediaFile?.baseUrl || item.baseUrl;
    const mimeType = item.mediaFile?.mimeType || item.mimeType || 'image/jpeg';
    const width = item.mediaFile?.mediaFileMetadata?.width 
      ? Number(item.mediaFile.mediaFileMetadata.width) 
      : (item.mediaMetadata?.width ? Number(item.mediaMetadata.width) : 1920);
    const height = item.mediaFile?.mediaFileMetadata?.height 
      ? Number(item.mediaFile.mediaFileMetadata.height) 
      : (item.mediaMetadata?.height ? Number(item.mediaMetadata.height) : 1080);

    if (onProgress) {
      onProgress(i + 1, mediaItems.length, filename);
    }

    if (!baseUrl) {
      console.warn('[Picker] Item missing baseUrl:', item);
      continue;
    }

    let blob: Blob | null = null;
    // Try multiple download options: =w2048, =d, =w2048-h1536, raw baseUrl
    const downloadUrls = [
      baseUrl.includes('?') ? `${baseUrl}&w=2048` : `${baseUrl}=w2048`,
      baseUrl.includes('?') ? `${baseUrl}&d=true` : `${baseUrl}=d`,
      baseUrl.includes('?') ? `${baseUrl}&w=2048&h=1536` : `${baseUrl}=w2048-h1536`,
      baseUrl,
    ];

    for (const dUrl of downloadUrls) {
      try {
        blob = await fetchPhotoBlob(dUrl, accessToken);
        if (blob && blob.size > 0) break;
      } catch (err) {
        // try next candidate URL
      }
    }

    if (blob && blob.size > 0) {
      try {
        const cachedPhoto: CachedPhoto = {
          id: itemId,
          albumId,
          filename,
          mimeType,
          creationTime: item.createTime || new Date().toISOString(),
          width,
          height,
          blob,
          cachedAt: Date.now(),
          sizeBytes: blob.size,
        };

        await db.savePhoto(cachedPhoto);
        addedCount++;
        if (!firstCoverUrl) {
          firstCoverUrl = baseUrl;
        }
      } catch (saveErr) {
        console.warn('Failed to save picked photo into IndexedDB:', filename, saveErr);
      }
    } else {
      console.warn('Failed to download any blob for photo:', filename);
    }
  }

  const cachedPhotos = await db.getPhotosByAlbum(albumId);
  if (cachedPhotos.length === 0) {
    throw new Error('Could not download image data for the selected photos. Please check your connection and try again.');
  }

  // If existing album, preserve existing album properties
  const existingAlbum = isExisting ? await db.getAlbum(albumId) : null;

  const finalAlbum: Album = {
    id: albumId,
    title: existingAlbum?.title || albumTitle || `Google Photos (${new Date().toLocaleDateString()})`,
    mediaItemsCount: cachedPhotos.length,
    cachedCount: cachedPhotos.length,
    lastSyncedAt: Date.now(),
    coverPhotoBaseUrl: firstCoverUrl || existingAlbum?.coverPhotoBaseUrl || undefined,
    isPickerAlbum: existingAlbum?.isPickerAlbum ?? true,
    isLocalAlbum: existingAlbum?.isLocalAlbum,
    googleAlbumId: existingAlbum?.googleAlbumId,
  };

  await db.saveAlbum(finalAlbum);
  return { album: finalAlbum, addedCount };
}

// -------------------------------------------------------------
// Offline Local Photos / Folder Import
// -------------------------------------------------------------

export async function importLocalPhotos(
  files: FileList | File[],
  albumTitle: string = 'My Uploaded Photos',
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<Album> {
  const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (fileArray.length === 0) {
    throw new Error('No valid image files were selected.');
  }

  const albumId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let firstCoverBlob: Blob | null = null;

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    if (onProgress) {
      onProgress(i + 1, fileArray.length, file.name);
    }

    const photoId = `photo_${albumId}_${i}_${Date.now()}`;
    const blob = file.slice(0, file.size, file.type || 'image/jpeg');
    if (!firstCoverBlob) firstCoverBlob = blob;

    let width = 1920;
    let height = 1080;
    try {
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          width = img.naturalWidth;
          height = img.naturalHeight;
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    } catch {
      // ignore
    }

    const cachedPhoto: CachedPhoto = {
      id: photoId,
      albumId,
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      creationTime: new Date(file.lastModified || Date.now()).toISOString(),
      width,
      height,
      blob,
      cachedAt: Date.now(),
      sizeBytes: file.size,
    };

    await db.savePhoto(cachedPhoto);
  }

  const newAlbum: Album = {
    id: albumId,
    title: albumTitle,
    mediaItemsCount: fileArray.length,
    cachedCount: fileArray.length,
    lastSyncedAt: Date.now(),
    isLocalAlbum: true,
  };

  await db.saveAlbum(newAlbum);
  return newAlbum;
}

// Fetch media items inside an album
export async function fetchAlbumMediaItems(
  albumId: string,
  accessToken: string,
  maxItems: number = 100
): Promise<GooglePhotoItem[]> {
  const items: GooglePhotoItem[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const bodyPayload: any = {
      albumId,
      pageSize: Math.min(maxItems - items.length, 100),
    };
    if (pageToken) bodyPayload.pageToken = pageToken;

    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('TOKEN_EXPIRED');
      throw new Error(`Failed to load photos: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.mediaItems && Array.isArray(data.mediaItems)) {
      for (const item of data.mediaItems) {
        items.push({
          id: item.id,
          filename: item.filename,
          baseUrl: item.baseUrl,
          mimeType: item.mimeType,
          description: item.description,
          creationTime: item.mediaMetadata?.creationTime,
          width: item.mediaMetadata?.width,
          height: item.mediaMetadata?.height,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken && items.length < maxItems);

  return items;
}

// Sync album into offline IndexedDB cache
export async function syncAlbumToCache(
  album: Album,
  accessToken?: string,
  onProgress?: (cachedCount: number, totalCount: number, currentPhotoName: string) => void
): Promise<{ added: number; removed: number; total: number }> {
  // Handle sample album case (doesn't need Google Photos API)
  if (album.isSampleAlbum || album.id === SAMPLE_ALBUM.id) {
    const existing = await db.getPhotosByAlbum(album.id);
    if (existing.length === SAMPLE_PHOTOS_RAW.length) {
      return { added: 0, removed: 0, total: existing.length };
    }

    let added = 0;
    for (let i = 0; i < SAMPLE_PHOTOS_RAW.length; i++) {
      const sample = SAMPLE_PHOTOS_RAW[i];
      if (existing.some((p) => p.id === sample.id)) continue;

      if (onProgress) {
        onProgress(i + 1, SAMPLE_PHOTOS_RAW.length, sample.filename);
      }

      try {
        const blob = await fetchPhotoBlob(sample.url);
        const cachedPhoto: CachedPhoto = {
          id: sample.id,
          albumId: album.id,
          filename: sample.filename,
          mimeType: 'image/jpeg',
          description: sample.description,
          creationTime: sample.creationTime,
          width: sample.width,
          height: sample.height,
          blob,
          cachedAt: Date.now(),
          sizeBytes: blob.size,
        };
        await db.savePhoto(cachedPhoto);
        added++;
      } catch (err) {
        console.warn('Failed to cache sample photo:', sample.filename, err);
      }
    }

    const updatedAlbum: Album = {
      ...album,
      lastSyncedAt: Date.now(),
      cachedCount: (await db.getPhotosByAlbum(album.id)).length,
    };
    await db.saveAlbum(updatedAlbum);
    return { added, removed: 0, total: updatedAlbum.cachedCount || 0 };
  }

  // Handle local album
  if (album.isLocalAlbum) {
    const existing = await db.getPhotosByAlbum(album.id);
    return { added: 0, removed: 0, total: existing.length };
  }

  // Google Photos real album sync
  if (!accessToken) {
    throw new Error('Access token required to sync Google Photos album');
  }

  // Determine target Google Photos album ID
  const googlePhotosAlbumId =
    album.googleAlbumId || (!album.isPickerAlbum && !album.isLocalAlbum && !album.isSampleAlbum ? album.id : null);

  if (!googlePhotosAlbumId) {
    // For picker-based albums without a linked Library album ID, return existing cached photos
    const existing = await db.getPhotosByAlbum(album.id);
    return { added: 0, removed: 0, total: existing.length };
  }

  // 1. Fetch live media item list from Google Photos API
  let liveItems: GooglePhotoItem[] = [];
  try {
    liveItems = await fetchAlbumMediaItems(googlePhotosAlbumId, accessToken, 200);
  } catch (fetchErr: any) {
    console.warn('[Sync] Could not fetch live media items from Google Photos Library API:', fetchErr);
    const existing = await db.getPhotosByAlbum(album.id);
    return { added: 0, removed: 0, total: existing.length };
  }

  // 2. Fetch existing cached photos from IndexedDB
  const existingPhotos = await db.getPhotosByAlbum(album.id);
  const existingIdMap = new Map(existingPhotos.map((p) => [p.id, p]));

  // 3. Find removed photos (in DB but not in live album)
  const liveIdSet = new Set(liveItems.map((item) => item.id));
  const removedIds: string[] = [];
  for (const existing of existingPhotos) {
    if (!liveIdSet.has(existing.id)) {
      removedIds.push(existing.id);
    }
  }

  if (removedIds.length > 0) {
    await db.deletePhotos(removedIds);
  }

  // 4. Download and cache new photos
  let addedCount = 0;
  const totalToProcess = liveItems.length;

  for (let i = 0; i < liveItems.length; i++) {
    const item = liveItems[i];
    if (onProgress) {
      onProgress(i + 1, totalToProcess, item.filename);
    }

    if (existingIdMap.has(item.id)) {
      // Already cached!
      continue;
    }

    try {
      // Request high quality tablet resolution (width 2048, height 1536)
      const downloadUrl = `${item.baseUrl}=w2048-h1536`;
      const blob = await fetchPhotoBlob(downloadUrl);

      const cachedPhoto: CachedPhoto = {
        id: item.id,
        albumId: album.id,
        filename: item.filename,
        mimeType: item.mimeType,
        description: item.description,
        creationTime: item.creationTime,
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        blob,
        cachedAt: Date.now(),
        sizeBytes: blob.size,
      };

      await db.savePhoto(cachedPhoto);
      addedCount++;
    } catch (err) {
      console.warn(`Failed to download photo ${item.filename}:`, err);
    }
  }

  // 5. Update album record in DB
  const finalPhotos = await db.getPhotosByAlbum(album.id);
  const updatedAlbum: Album = {
    ...album,
    lastSyncedAt: Date.now(),
    cachedCount: finalPhotos.length,
    mediaItemsCount: liveItems.length,
  };
  await db.saveAlbum(updatedAlbum);

  return {
    added: addedCount,
    removed: removedIds.length,
    total: finalPhotos.length,
  };
}
