import React, { useState } from 'react';
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
}) => {
  const [cachingAlbumId, setCachingAlbumId] = useState<string | null>(null);
  const [cachingProgress, setCachingProgress] = useState<{ current: number; total: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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
      setCachingProgress(null);
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

  return (
    <div
      id="album-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="album-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Photo Albums</h2>
              <p className="text-xs text-zinc-400">
                Choose an album to stream and cache for 100% offline playback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authUser && (
              <button
                id="btn-refresh-album-list"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                title="Refresh albums from Google Photos"
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

        {/* Google Photos Account Status Banner */}
        {!authUser ? (
          <div className="mt-4 p-4 rounded-2xl bg-zinc-800/60 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Connect your Google Photos Account
                </p>
                <p className="text-xs text-zinc-400">
                  Anyone can log in and browse personal & family albums. Login is cached on this tablet.
                </p>
              </div>
            </div>
            <button
              id="btn-connect-google-photos-banner"
              onClick={onConnectGoogle}
              className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold rounded-xl transition-all shadow-md shrink-0"
            >
              Sign In with Google
            </button>
          </div>
        ) : (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Connected as <strong className="text-white">{authUser.name}</strong> ({authUser.email})
              </span>
            </div>
            <span className="text-emerald-400 font-medium">Session Cached</span>
          </div>
        )}

        {/* Album List */}
        <div className="mt-4 overflow-y-auto pr-1 space-y-2.5 flex-1 max-h-[50vh]">
          {albums.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
              <p className="text-sm">No albums found in this account.</p>
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

                    {cachedCount > 0 && (
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
