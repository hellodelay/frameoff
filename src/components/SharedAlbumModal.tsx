import React, { useState } from 'react';
import {
  X,
  Share2,
  ExternalLink,
  Check,
  AlertCircle,
  RefreshCw,
  Info,
  HelpCircle,
  Copy,
} from 'lucide-react';
import { fetchSharedAlbumInfo, SharedAlbumInfo } from '../services/googlePhotos';

interface SharedAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSharedAlbum: (url: string) => Promise<void>;
  isImporting?: boolean;
  importProgressText?: string;
}

export const SharedAlbumModal: React.FC<SharedAlbumModalProps> = ({
  isOpen,
  onClose,
  onImportSharedAlbum,
  isImporting = false,
  importProgressText = '',
}) => {
  const [url, setUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [albumPreview, setAlbumPreview] = useState<SharedAlbumInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('photos.app.goo.gl') || text.includes('photos.google.com'))) {
        setUrl(text.trim());
        setError(null);
      } else if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleCheckAlbum = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a Google Photos shared album link.');
      return;
    }

    if (!trimmed.includes('photos.app.goo.gl') && !trimmed.includes('photos.google.com')) {
      setError('Link must be a Google Photos URL (photos.app.goo.gl or photos.google.com/share/...)');
      return;
    }

    setIsChecking(true);
    setError(null);
    setAlbumPreview(null);

    try {
      const info = await fetchSharedAlbumInfo(trimmed);
      setAlbumPreview(info);
    } catch (err: any) {
      setError(err?.message || 'Could not load shared album. Make sure link sharing is enabled.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartImport = async () => {
    const targetUrl = albumPreview?.canonicalUrl || url.trim();
    if (!targetUrl) return;
    setError(null);
    try {
      await onImportSharedAlbum(targetUrl);
    } catch (err: any) {
      setError(err?.message || 'Failed to import photos from shared album.');
    }
  };

  return (
    <div
      id="shared-album-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="shared-album-modal-card"
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Import Shared Album
              </h2>
              <p className="text-xs text-zinc-400">
                Play shared albums from partners, family, or friends
              </p>
            </div>
          </div>

          <button
            id="btn-close-shared-album-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Explanation Banner: Why Google Picker doesn't show shared albums */}
          <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 text-xs space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-300">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Why doesn't Google's Photo Picker show shared albums?</span>
            </div>
            <p className="text-zinc-300 leading-relaxed text-[12px]">
              Google's official Picker API strictly protects privacy by only showing photos saved
              directly in <strong>your personal library</strong>. Albums created by others in the
              "Sharing" tab are excluded by Google.
            </p>
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 text-[11px] text-zinc-300">
                <span className="font-semibold text-amber-300 block mb-0.5">Option 1: Paste Link Below (Instant)</span>
                Paste any shared album link here. Pictorial downloads and caches the full album offline for continuous playback.
              </div>
              <div className="flex-1 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 text-[11px] text-zinc-300">
                <span className="font-semibold text-blue-300 block mb-0.5">Option 2: "Save to library" in Google Photos</span>
                In Google Photos, open the shared album and tap <strong className="text-white">"Save photos"</strong> (cloud icon). They will then appear in the Picker!
              </div>
            </div>
          </div>

          {/* Link Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="shared-url-input" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Google Photos Shared Link
              </label>
              <div className="flex items-center gap-3">
                <a
                  href="https://photos.google.com/albums"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 transition-colors"
                  title="Open Google Photos Albums in a new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Google Photos Albums</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowHowTo(!showHowTo)}
                  className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How to get link</span>
                </button>
              </div>
            </div>

            {/* Expandable "How to get link" instructions */}
            {showHowTo && (
              <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-xs text-zinc-300 space-y-2 animate-in fade-in duration-200">
                <p className="font-medium text-white">How to view your albums and copy their share links:</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-300 text-[11.5px]">
                  <li>
                    Go to your Google Photos albums at{' '}
                    <a
                      href="https://photos.google.com/albums"
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-300 underline font-medium inline-flex items-center gap-0.5 hover:text-white"
                    >
                      photos.google.com/albums <ExternalLink className="w-3 h-3 inline" />
                    </a>{' '}
                    (or open the Google Photos app and tap the <strong>&quot;Albums&quot;</strong> tab).
                  </li>
                  <li>Click into any album you want to display on your frame.</li>
                  <li>Click or tap the <strong className="text-zinc-100">Share icon</strong> (or three dots <strong className="text-zinc-100">⋮</strong> &gt; <strong className="text-zinc-100">Options</strong>).</li>
                  <li>Select <strong className="text-zinc-100">&quot;Create link&quot;</strong> or <strong className="text-zinc-100">&quot;Copy link&quot;</strong>.</li>
                  <li>Paste the copied link below — Pictorial will cache it offline and keep it updated!</li>
                </ol>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="shared-url-input"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isChecking && !isImporting) {
                      if (albumPreview) handleStartImport();
                      else handleCheckAlbum();
                    }
                  }}
                  placeholder="https://photos.app.goo.gl/... or https://photos.google.com/share/..."
                  disabled={isChecking || isImporting}
                  className="w-full bg-zinc-800/90 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>

              {navigator.clipboard && (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  disabled={isChecking || isImporting}
                  className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                  title="Paste link from clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
              )}
            </div>

            {/* Quick Test Links */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Test links:</span>
              <button
                type="button"
                onClick={() => {
                  setUrl('https://photos.app.goo.gl/EsbymfNGcdqgT9fN7');
                  setError(null);
                  setAlbumPreview(null);
                }}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 border border-zinc-700/70 transition-colors text-[11.5px]"
              >
                photos.app.goo.gl (Short link)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrl('https://photos.google.com/share/AF1QipNh3qjDAuvUMQlxxcvXH0yDnNX1DnSyxISM4d1N2GtiRdcDfAEjwLMPBJBOvmEdLg?key=WWhBZ3VlMW40S0RZM0tCd2lJcHg1aTU5RnJZdnJB');
                  setError(null);
                  setAlbumPreview(null);
                }}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 border border-zinc-700/70 transition-colors text-[11.5px]"
              >
                photos.google.com/share (Direct)
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {(error.includes('personal') || error.includes('private') || error.includes('Share Link') || error.includes('405') || error.includes('Method Not Allowed')) && (
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 text-[11.5px] text-zinc-300">
                  <p className="font-semibold text-amber-300 mb-1">💡 How to get a Google Photos Share Link:</p>
                  <p className="leading-relaxed">
                    In Google Photos, open the album and tap the <strong>Share</strong> button (or Options ⋮) &gt; select <strong>&quot;Create link&quot;</strong> or <strong>&quot;Copy link&quot;</strong>, then paste that link here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Album Preview Card if checked */}
          {albumPreview && (
            <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700/80 flex items-center gap-4 animate-in fade-in duration-200">
              {albumPreview.coverPhotoBaseUrl ? (
                <img
                  src={`/api/proxy-photo?url=${encodeURIComponent(`${albumPreview.coverPhotoBaseUrl.split('=')[0]}=w200-h200-c`)}`}
                  alt={albumPreview.title}
                  className="w-20 h-20 rounded-xl object-cover bg-zinc-900 shrink-0 border border-white/10 shadow-sm"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                  <Share2 className="w-8 h-8" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 mb-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Album Ready to Import</span>
                </div>
                <h3 className="font-semibold text-white text-base truncate">
                  {albumPreview.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {albumPreview.count} {albumPreview.count === 1 ? 'photo' : 'photos'} detected
                </p>
              </div>
            </div>
          )}

          {/* Progress / Status display during import */}
          {isImporting && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2 text-amber-200">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Downloading & Caching Offline...</span>
                </span>
              </div>
              <p className="text-[11.5px] text-zinc-300">{importProgressText || 'Processing photos for slideshow...'}</p>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-400 h-1.5 rounded-full animate-pulse w-3/4 transition-all duration-300" />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 sm:p-6 border-t border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors"
          >
            Cancel
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2.5">
            {!albumPreview ? (
              <button
                id="btn-inspect-shared-album"
                type="button"
                onClick={handleCheckAlbum}
                disabled={isChecking || !url.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Checking Link...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Check Album Link</span>
                  </>
                )}
              </button>
            ) : (
              <button
                id="btn-confirm-import-shared-album"
                type="button"
                onClick={handleStartImport}
                disabled={isImporting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Importing Photos...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Import Album & Start Slideshow</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
