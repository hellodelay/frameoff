import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  Download,
  Trash2,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { Album, AuthUser, SyncState } from '../types';

interface AlbumPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: Album[];
  selectedAlbumId: string | null;
  onSelectAlbum: (album: Album) => void;
  onCacheAlbum: (album: Album) => Promise<void>;
  onDeleteAlbumCache: (albumId: string) => Promise<void>;
  onRefreshAlbums: () => Promise<void>;
  authUser: AuthUser | null;
  onConnectGoogle: () => void;
  syncState: SyncState;
  storageStats: { totalCount: number; totalBytes: number };
  onStartGooglePicker?: () => Promise<void>;
  onImportLocalPhotos?: (files: FileList | File[], title?: string) => Promise<void>;
  albumFetchError?: string | null;
  isPickingGooglePhotos?: boolean;
}

export const AlbumPickerModal: React.FC<AlbumPickerModalProps> = ({
  isOpen,
  onClose,
  albums,
  selectedAlbumId,
  onSelectAlbum,
  onCacheAlbum,
  onDeleteAlbumCache,
  onRefreshAlbums,
  authUser,
  onConnectGoogle,
  syncState,
  storageStats,
  onStartGooglePicker,
  onImportLocalPhotos,
  albumFetchError,
  isPickingGooglePhotos,
}) => {
  const [cachingAlbumId, setCachingAlbumId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleCacheClick = async (e: React.MouseEvent, album: Album) => {
    e.stopPropagation();
    setCachingAlbumId(album.id);
    try {
      await onCacheAlbum(album);
    } finally {
      setCachingAlbumId(null);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, albumId: string) => {
    e.stopPropagation();
    if (confirm('Clear offline cached photos for this album? You can re-download anytime.')) {
      await onDeleteAlbumCache(albumId);
    }
  };

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshAlbums();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImportLocalPhotos) {
      onImportLocalPhotos(e.target.files);
    }
  };

  return (
    <div
      id="album-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="album-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[88vh] text-zinc-100"
      >
        {/* Hidden local file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Photo Albums</h2>
              <p className="text-xs text-zinc-400">
                Choose an album or import photos for 100% offline playback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authUser && (
              <button
                id="btn-refresh-album-list"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                title="Scan legacy Google Photos albums"
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              id="btn-close-album-modal"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons: Pick from Google Photos & Upload Local */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {authUser ? (
            <button
              id="btn-modal-pick-google-photos"
              onClick={onStartGooglePicker}
              disabled={isPickingGooglePhotos}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isPickingGooglePhotos ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Waiting for Google Picker...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#1E1E1E"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#1E1E1E"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                  </svg>
                  <span>Pick Photos from Google</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="btn-modal-connect-google"
              onClick={onConnectGoogle}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs sm:text-sm border border-zinc-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Connect Google Account</span>
            </button>
          )}

          <button
            id="btn-modal-upload-local-photos"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white font-medium text-xs sm:text-sm border border-zinc-700/80 transition-colors"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload Device Photos / Folder</span>
          </button>
        </div>

        {/* Guidance on selecting photos & albums */}
        <div className="mt-3 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium text-zinc-200">
              How to import an Album from Google Photos:
            </p>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              When the Google Photos window opens, navigate to the <strong>Albums</strong> tab, open your album, select the photos you want in your frame, and click <strong>Done</strong>. Google requires picking the media items inside an album, and Pictorial will automatically create a dedicated album and download them for 100% offline playback.
            </p>
          </div>
        </div>

        {/* Diagnostic Banner if Google Photos API returned an issue or 403 */}
        {albumFetchError && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Google Photos API Notice</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              Google deprecated third-party automated album listing. Use the <strong>"Pick Photos from Google"</strong> button above to securely select your albums or photos with Google's official picker.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] text-zinc-400">
              <span>Need help? Ensure <strong>Google Photos Picker API</strong> is enabled in Google Cloud Console.</span>
              <a
                href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                Enable API <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Account Info Status */}
        {authUser && (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Connected as <strong className="text-white">{authUser.name}</strong> ({authUser.email})
              </span>
            </div>
            <span className="text-emerald-400 font-medium">Ready to Pick</span>
          </div>
        )}

        {/* Album List */}
        <div className="mt-4 overflow-y-auto pr-1 space-y-2.5 flex-1 max-h-[46vh]">
          {albums.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
              <p className="text-sm">No albums available. Click "Pick Photos from Google" or "Upload Device Photos" to add some!</p>
            </div>
          ) : (
            albums.map((album) => {
              const isSelected = album.id === selectedAlbumId;
              const isCaching = cachingAlbumId === album.id;
              const cachedCount = album.cachedCount || 0;
              const totalCount =
                typeof album.mediaItemsCount === 'number'
                  ? album.mediaItemsCount
                  : album.isSampleAlbum
                  ? 8
                  : undefined;

              return (
                <div
                  key={album.id}
                  onClick={() => onSelectAlbum(album)}
                  className={`group relative flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-md'
                      : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Cover Thumbnail */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-950 shrink-0 border border-white/5 relative">
                      {album.coverPhotoBaseUrl ? (
                        <img
                          src={album.coverPhotoBaseUrl}
                          alt={album.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <FolderOpen className="w-6 h-6" />
                        </div>
                      )}
                      {album.isSampleAlbum && (
                        <span className="absolute bottom-1 right-1 bg-amber-500 text-zinc-950 font-bold text-[9px] px-1 rounded">
                          DEMO
                        </span>
                      )}
                      {album.isPickerAlbum && (
                        <span className="absolute bottom-1 right-1 bg-blue-500 text-white font-bold text-[9px] px-1 rounded">
                          PICKER
                        </span>
                      )}
                      {album.isLocalAlbum && (
                        <span className="absolute bottom-1 right-1 bg-emerald-500 text-zinc-950 font-bold text-[9px] px-1 rounded">
                          LOCAL
                        </span>
                      )}
                    </div>

                    {/* Album Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[280px]">
                          {album.title}
                        </h3>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-400/30">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                        {totalCount !== undefined && <span>{totalCount} photos</span>}
                        {cachedCount > 0 ? (
                          <span className="text-emerald-400 font-medium">
                            {cachedCount} cached offline
                          </span>
                        ) : (
                          <span className="text-zinc-500">Not cached yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this album */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id={`btn-cache-album-${album.id}`}
                      onClick={(e) => handleCacheClick(e, album)}
                      disabled={isCaching}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        isCaching
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                      }`}
                      title="Download full-resolution photos for 100% offline tablet playback"
                    >
                      {isCaching ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="hidden sm:inline">
                        {isCaching ? 'Caching...' : cachedCount > 0 ? 'Re-cache' : 'Cache Offline'}
                      </span>
                    </button>

                    {cachedCount > 0 && !album.isSampleAlbum && (
                      <button
                        id={`btn-delete-cache-${album.id}`}
                        onClick={(e) => handleDeleteClick(e, album.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete cached offline photos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Offline Storage Footprint */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-zinc-400" />
            <span>
              Tablet Offline Storage: <strong className="text-zinc-200">{formatBytes(storageStats.totalBytes)}</strong> ({storageStats.totalCount} photos stored)
            </span>
          </div>
          <span className="text-zinc-500 hidden sm:inline">IndexedDB Local Cache</span>
        </div>
      </div>
    </div>
  );
};
