import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CachedPhoto, FrameSettings } from '../types';
import { Calendar, Image as ImageIcon } from 'lucide-react';

interface PhotoFrameProps {
  photos: CachedPhoto[];
  currentIndex: number;
  direction?: number;
  isPlaying?: boolean;
  settings: FrameSettings;
  onNext: () => void;
  onPrev: () => void;
  onTapScreen: () => void;
}

export const PhotoFrame: React.FC<PhotoFrameProps> = ({
  photos,
  currentIndex,
  direction = 1,
  isPlaying = true,
  settings,
  onNext,
  onPrev,
  onTapScreen,
}) => {
  const currentPhoto = photos[currentIndex];
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const kenBurnsVariantIndex = currentIndex % 4;

  // Cache for object URLs to prevent re-creation and GC pressure
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  // Touch swipe handling for tablets
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Helper to obtain or reuse an Object URL for a photo
  const getOrCreatePhotoUrl = useCallback((photo: CachedPhoto | undefined): string => {
    if (!photo) return '';
    if (photo.dataUrl) return photo.dataUrl;

    const existing = blobUrlMapRef.current.get(photo.id);
    if (existing) return existing;

    if (photo.blob) {
      const url = URL.createObjectURL(photo.blob);
      blobUrlMapRef.current.set(photo.id, url);
      return url;
    }

    return '';
  }, []);

  // Preload and decode next/prev images into browser GPU memory
  useEffect(() => {
    if (photos.length === 0) return;

    // Current photo URL
    const currentUrl = getOrCreatePhotoUrl(currentPhoto);

    // Preload next and prev photos
    const nextIdx = (currentIndex + 1) % photos.length;
    const prevIdx = (currentIndex - 1 + photos.length) % photos.length;
    const nextPhoto = photos[nextIdx];
    const prevPhoto = photos[prevIdx];

    const nextUrl = getOrCreatePhotoUrl(nextPhoto);
    const prevUrl = getOrCreatePhotoUrl(prevPhoto);

    const preloadAndDecode = (url: string) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    };

    preloadAndDecode(currentUrl);
    preloadAndDecode(nextUrl);
    preloadAndDecode(prevUrl);

    // Clean up older cached URLs if cache grows too large (> 50)
    if (blobUrlMapRef.current.size > 50) {
      const activeIds = new Set([currentPhoto?.id, nextPhoto?.id, prevPhoto?.id]);
      for (const [id, url] of blobUrlMapRef.current.entries()) {
        if (!activeIds.has(id)) {
          URL.revokeObjectURL(url);
          blobUrlMapRef.current.delete(id);
        }
      }
    }
  }, [currentIndex, currentPhoto, photos, getOrCreatePhotoUrl]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const map = blobUrlMapRef.current;
    return () => {
      for (const url of map.values()) {
        URL.revokeObjectURL(url);
      }
      map.clear();
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Touch event handlers for tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    // Minimum swipe threshold
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        onNext(); // swipe left -> next
      } else {
        onPrev(); // swipe right -> prev
      }
    } else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
      onTapScreen();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Format photo date
  const formattedPhotoDate = useMemo(() => {
    if (!currentPhoto?.creationTime) return '';
    try {
      const d = new Date(currentPhoto.creationTime);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }, [currentPhoto?.creationTime]);

  const currentPhotoUrl = getOrCreatePhotoUrl(currentPhoto);

  if (!currentPhoto || !currentPhotoUrl) {
    return (
      <div
        id="empty-frame"
        onClick={onTapScreen}
        className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 p-6 select-none cursor-pointer"
      >
        <ImageIcon className="w-16 h-16 mb-4 text-zinc-600 animate-pulse" />
        <h2 className="text-xl font-medium text-zinc-200">No Photos In Current Album</h2>
        <p className="text-sm text-zinc-400 mt-2 text-center max-w-md">
          Tap anywhere on screen to open album selection or connect your Google Photos account.
        </p>
      </div>
    );
  }

  const isFitBlur = settings.fitMode === 'fit-blur';
  const isCover = settings.fitMode === 'cover';

  // Ken Burns dynamic pan/zoom presets
  const kenBurnsPresets = [
    { startScale: 1.0, endScale: 1.1, startX: '0%', endX: '-2%', startY: '0%', endY: '-1.5%' },
    { startScale: 1.1, endScale: 1.02, startX: '-2%', endX: '1.5%', startY: '-1%', endY: '1%' },
    { startScale: 1.02, endScale: 1.12, startX: '1.5%', endX: '-1%', startY: '1%', endY: '-1.5%' },
    { startScale: 1.12, endScale: 1.0, startX: '-1%', endX: '0%', startY: '-1.5%', endY: '0%' },
  ];
  const kbConfig = kenBurnsPresets[kenBurnsVariantIndex];
  const kbDuration = Math.max(settings.transitionSpeed, 6);

  // Define transition animation variants for motion/react
  const getVariants = () => {
    const dir = direction >= 0 ? 1 : -1;

    switch (settings.transitionEffect) {
      case 'kenburns':
        return {
          enter: {
            opacity: 0,
            scale: kbConfig.startScale,
            x: kbConfig.startX,
            y: kbConfig.startY,
          },
          center: {
            opacity: 1,
            scale: kbConfig.endScale,
            x: kbConfig.endX,
            y: kbConfig.endY,
            transition: {
              opacity: { duration: 1.3, ease: 'easeInOut' as const },
              scale: { duration: kbDuration, ease: 'linear' as const },
              x: { duration: kbDuration, ease: 'linear' as const },
              y: { duration: kbDuration, ease: 'linear' as const },
            },
          },
          exit: {
            opacity: 0,
            transition: { duration: 1.2, ease: 'easeInOut' as const },
          },
        };

      case 'slide':
        return {
          enter: {
            x: dir > 0 ? '100%' : '-100%',
            opacity: 1,
          },
          center: {
            x: '0%',
            opacity: 1,
            transition: {
              x: { duration: 0.75, ease: 'easeOut' as const },
            },
          },
          exit: {
            x: dir > 0 ? '-100%' : '100%',
            opacity: 1,
            transition: {
              x: { duration: 0.75, ease: 'easeIn' as const },
            },
          },
        };

      case 'zoom':
        return {
          enter: {
            scale: 1.08,
            opacity: 0,
          },
          center: {
            scale: 1,
            opacity: 1,
            transition: {
              scale: { duration: 1.1, ease: 'easeOut' as const },
              opacity: { duration: 0.9, ease: 'easeOut' as const },
            },
          },
          exit: {
            scale: 0.95,
            opacity: 0,
            transition: {
              scale: { duration: 0.9, ease: 'easeIn' as const },
              opacity: { duration: 0.8, ease: 'easeIn' as const },
            },
          },
        };

      case 'flip':
        return {
          enter: {
            rotateY: dir > 0 ? 70 : -70,
            opacity: 0,
            scale: 0.92,
          },
          center: {
            rotateY: 0,
            opacity: 1,
            scale: 1,
            transition: {
              duration: 0.8,
              ease: 'easeOut' as const,
            },
          },
          exit: {
            rotateY: dir > 0 ? -70 : 70,
            opacity: 0,
            scale: 0.92,
            transition: {
              duration: 0.7,
              ease: 'easeIn' as const,
            },
          },
        };

      case 'cut':
        return {
          enter: { opacity: 1 },
          center: { opacity: 1 },
          exit: { opacity: 0, transition: { duration: 0 } },
        };

      case 'crossfade':
      default:
        return {
          enter: {
            opacity: 0,
          },
          center: {
            opacity: 1,
            transition: {
              opacity: { duration: 1.25, ease: 'easeInOut' as const },
            },
          },
          exit: {
            opacity: 0,
            transition: {
              opacity: { duration: 1.25, ease: 'easeInOut' as const },
            },
          },
        };
    }
  };

  const variants = getVariants();

  return (
    <div
      id="photo-frame-container"
      className="relative w-full h-full overflow-hidden bg-black select-none cursor-pointer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onTapScreen}
      style={{ perspective: settings.transitionEffect === 'flip' ? 1400 : undefined }}
    >
      {/* Smooth Blurred Ambient Backdrop for "fit-blur" mode */}
      {isFitBlur && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <AnimatePresence>
            <motion.div
              key={`backdrop-${currentPhoto.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
              className="absolute inset-0"
              style={{
                willChange: 'opacity',
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src={currentPhotoUrl}
                alt=""
                className="w-full h-full object-cover filter blur-2xl scale-110 brightness-75"
                style={{
                  transform: 'translate3d(0, 0, 0)',
                  backfaceVisibility: 'hidden',
                }}
              />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Primary Photo Canvas with AnimatePresence */}
      <div className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden">
        <AnimatePresence custom={direction}>
          <motion.div
            key={currentPhoto.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              transformStyle: settings.transitionEffect === 'flip' ? 'preserve-3d' : undefined,
            }}
          >
            <img
              src={currentPhotoUrl}
              alt={currentPhoto.description || currentPhoto.filename}
              className={`max-w-full max-h-full ${
                isCover ? 'w-full h-full object-cover' : 'object-contain'
              }`}
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Ambient Clock & Date Overlay (Top Left) */}
      {settings.showClock && (
        <div
          id="frame-clock-widget"
          className="absolute top-6 left-6 z-20 pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
        >
          <div className="text-white font-light tracking-tight text-3xl sm:text-5xl font-mono">
            {currentTime}
          </div>
          <div className="text-zinc-200 text-sm sm:text-base font-medium flex items-center gap-1.5 mt-1 tracking-wide">
            <Calendar className="w-3.5 h-3.5 text-zinc-300" />
            <span>{currentDate}</span>
          </div>
        </div>
      )}

      {/* Photo Info Overlay (Bottom Left) */}
      {settings.showPhotoInfo && (currentPhoto.description || formattedPhotoDate) && (
        <div
          id="frame-photo-info"
          className="absolute bottom-6 left-6 z-20 pointer-events-none max-w-lg drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
        >
          {currentPhoto.description && (
            <p className="text-white font-medium text-base sm:text-lg line-clamp-2 leading-snug">
              {currentPhoto.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-zinc-300 text-xs sm:text-sm mt-1">
            {formattedPhotoDate && <span>{formattedPhotoDate}</span>}
            {currentPhoto.filename && (
              <span className="opacity-75 truncate max-w-[200px]">
                {currentPhoto.filename}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Photo Counter Pill (Top Right) */}
      <div
        id="frame-counter-pill"
        className="absolute top-6 right-6 z-20 pointer-events-none bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-zinc-300 border border-white/10 shadow-lg"
      >
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Subtle Bottom Border Slideshow Progress Bar */}
      {photos.length > 1 && (
        <div
          id="frame-bottom-progress-track"
          className="absolute bottom-0 left-0 right-0 h-[1.5px] sm:h-[2px] z-20 pointer-events-none bg-white/[0.05] overflow-hidden"
          title={isPlaying ? `Next photo in ${settings.transitionSpeed}s` : 'Paused'}
        >
          <div
            id="frame-bottom-progress-bar"
            key={`${currentIndex}-${settings.transitionSpeed}`}
            className={`h-full w-full origin-left bg-white/35 transition-opacity duration-300 ${
              isPlaying ? 'opacity-100' : 'opacity-30'
            }`}
            style={{
              animation: `screen-bottom-fill ${settings.transitionSpeed}s linear forwards`,
              animationPlayState: isPlaying ? 'running' : 'paused',
              transformOrigin: 'left center',
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
            }}
          />
        </div>
      )}
    </div>
  );
};
