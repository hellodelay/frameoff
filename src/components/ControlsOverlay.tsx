import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Maximize,
  Minimize,
  Sliders,
  FolderOpen,
  Wifi,
  WifiOff,
  Sun,
  RefreshCw,
  X,
  Home,
} from 'lucide-react';
import { Album, FrameSettings, SyncState } from '../types';

interface ControlsOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  settings: FrameSettings;
  onUpdateSettings: (newSettings: Partial<FrameSettings>) => void;
  onOpenAlbums: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
  onManualSync: () => void;
  currentAlbum: Album | null;
  syncState: SyncState;
  syncProgressText?: string;
  isWakeLockActive: boolean;
  isOnline: boolean;
  timeRemainingSeconds: number;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  visible,
  onDismiss,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  settings,
  onUpdateSettings,
  onOpenAlbums,
  onOpenSettings,
  onGoHome,
  onManualSync,
  currentAlbum,
  syncState,
  syncProgressText,
  isWakeLockActive,
  isOnline,
  timeRemainingSeconds,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  if (!visible) return null;

  // Calculate transition progress percentage
  const progressPercent = isPlaying
    ? Math.max(0, Math.min(100, ((settings.transitionSpeed - timeRemainingSeconds) / settings.transitionSpeed) * 100))
    : 0;

  return (
    <div
      id="controls-overlay"
      onClick={(e) => e.stopPropagation()} // Prevent tap from instantly dismissing
      className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-transparent to-black/85 transition-opacity duration-300 pointer-events-auto"
    >
      {/* Top Bar: Album Title, Sync Status, Wake Lock Status, Close */}
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Home / Switch User button */}
          <button
            id="btn-go-home"
            onClick={onGoHome}
            className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800/90 backdrop-blur-md text-white px-3.5 py-2 rounded-xl text-sm font-medium border border-white/10 transition-colors shadow-lg"
            title="Go to Home / Switch User"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Home</span>
          </button>

          <button
            id="btn-current-album"
            onClick={onOpenAlbums}
            className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800/90 backdrop-blur-md text-white px-3.5 py-2 rounded-xl text-sm font-medium border border-white/10 transition-colors shadow-lg"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span className="truncate max-w-[160px] sm:max-w-[280px]">
              {currentAlbum ? currentAlbum.title : 'Select Album'}
            </span>
          </button>

          {/* Sync status button / indicator */}
          <button
            id="btn-sync-status"
            onClick={onManualSync}
            title="Check for new photos and update offline cache"
            className="flex items-center gap-1.5 bg-zinc-900/80 hover:bg-zinc-800 text-xs px-3 py-2 rounded-xl border border-white/10 text-zinc-300 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin text-blue-400' : 'text-zinc-400'}`}
            />
            <span className="hidden sm:inline">
              {syncState === 'syncing'
                ? syncProgressText || 'Syncing...'
                : syncState === 'offline'
                ? 'Offline Ready'
                : 'Sync Photos'}
            </span>
          </button>

          {/* Screen Wake Lock Status */}
          <div
            id="wake-lock-pill"
            title="Screen Wake Lock is active to keep the tablet display on"
            className="flex items-center gap-1.5 bg-zinc-900/80 text-xs px-2.5 py-2 rounded-xl border border-white/10 text-zinc-300"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isWakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <Sun className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">
              {isWakeLockActive ? 'Screen Awake' : 'Wake Lock Off'}
            </span>
          </div>

          {/* Online / Offline badge */}
          <div
            id="network-status-badge"
            className="flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl bg-zinc-900/80 border border-white/10 text-zinc-400"
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* Dismiss Controls Button */}
        <button
          id="btn-dismiss-overlay"
          onClick={onDismiss}
          className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 transition-colors shadow-lg"
          aria-label="Hide Controls"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Floating Control Console */}
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-3">
        {/* Subtle timer progress bar towards next photo */}
        {isPlaying && (
          <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="bg-amber-400 h-full transition-all duration-300 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <div className="w-full flex items-center justify-between gap-2 sm:gap-4 bg-zinc-950/90 backdrop-blur-xl border border-white/15 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl">
          {/* Left tools: Home, Shuffle & Settings */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              id="btn-bottom-home"
              onClick={onGoHome}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Go to Home / Switch User"
            >
              <Home className="w-5 h-5 text-emerald-400" />
            </button>

            <button
              id="btn-toggle-shuffle"
              onClick={() => onUpdateSettings({ shuffle: !settings.shuffle })}
              className={`p-2.5 rounded-xl transition-colors ${
                settings.shuffle
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={settings.shuffle ? 'Shuffle: On' : 'Shuffle: Off'}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              id="btn-open-settings"
              onClick={onOpenSettings}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Display & Frame Settings"
            >
              <Sliders className="w-5 h-5" />
            </button>
          </div>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              id="btn-prev-photo"
              onClick={onPrev}
              className="p-3 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
              title="Previous Photo"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            <button
              id="btn-toggle-play"
              onClick={onTogglePlay}
              className="p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-bold transition-all shadow-lg shadow-amber-500/20"
              title={isPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            <button
              id="btn-next-photo"
              onClick={onNext}
              className="p-3 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all"
              title="Next Photo"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Right tools: Speed/Effect Pills & Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              id="btn-quick-effect"
              onClick={onOpenSettings}
              className="hidden sm:flex items-center text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800"
              title="Change Transition Effect"
            >
              <span className="capitalize">{settings.transitionEffect}</span>
              <span className="ml-1 text-zinc-400 font-mono">({settings.transitionSpeed}s)</span>
            </button>

            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
