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
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const STORAGE_KEY_AUTH = 'gphotos_auth_user';
const STORAGE_KEY_CLIENT_ID = 'gphotos_custom_client_id';

// Default OAuth scopes for Google Photos Library access
export const GOOGLE_PHOTOS_SCOPES = [
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
        };
        saveCachedAuthUser(authUser);
        onSuccess(authUser);
      }
    },
  });

  return tokenClientInstance;
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
export async function fetchPhotoBlob(imageUrl: string): Promise<Blob> {
  // 1. Try direct fetch
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (directErr) {
    // Expected on strict CORS, fallback to proxy
  }

  // 2. Try proxy endpoint
  const proxyUrl = `/api/proxy-photo?url=${encodeURIComponent(imageUrl)}`;
  const proxyRes = await fetch(proxyUrl);
  if (!proxyRes.ok) {
    throw new Error(`Failed to download photo: ${proxyRes.status} ${proxyRes.statusText}`);
  }
  return await proxyRes.blob();
}

// Fetch list of albums from Google Photos
export async function fetchGoogleAlbums(accessToken: string): Promise<Album[]> {
  const albums: Album[] = [];

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
            title: a.title || 'Untitled Album',
            coverPhotoBaseUrl: a.coverPhotoBaseUrl,
            mediaItemsCount: a.mediaItemsCount ? Number(a.mediaItemsCount) : undefined,
          });
        }
      }
    } else if (res.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') throw err;
    console.warn('Error fetching own albums:', err);
  }

  // 2. Fetch shared albums
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

  return albums;
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

  // Google Photos real album sync
  if (!accessToken) {
    throw new Error('Access token required to sync Google Photos album');
  }

  // 1. Fetch live media item list from Google Photos API
  const liveItems = await fetchAlbumMediaItems(album.id, accessToken, 200);

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
