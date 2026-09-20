export interface GooglePhotoItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  description?: string;
  creationTime?: string;
  width?: string | number;
  height?: string | number;
}

export interface Album {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: number | string;
  isSampleAlbum?: boolean;
  isLocalAlbum?: boolean;
  isPickerAlbum?: boolean;
  googleAlbumId?: string;
  lastSyncedAt?: number;
  cachedCount?: number;
}

export interface CachedPhoto {
  id: string;
  albumId: string;
  filename: string;
  mimeType: string;
  creationTime?: string;
  description?: string;
  width?: number;
  height?: number;
  blob: Blob;
  dataUrl?: string;
  cachedAt: number;
  sizeBytes: number;
}

export type TransitionEffect = 'crossfade' | 'kenburns' | 'slide' | 'zoom' | 'flip' | 'cut';
export type FitMode = 'fit-blur' | 'cover' | 'contain';

export interface FrameSettings {
  transitionSpeed: number; // in seconds (e.g., 5, 10, 15, 30, 60)
  transitionEffect: TransitionEffect;
  fitMode: FitMode;
  keepScreenOn: boolean;
  shuffle: boolean;
  showClock: boolean;
  showPhotoInfo: boolean;
  syncIntervalMinutes: number; // e.g., 15, 30, 60, 360
  googleClientId: string;
  autoPlay: boolean;
}

export interface AuthUser {
  name: string;
  email: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
  scope?: string;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'success' | 'error';
