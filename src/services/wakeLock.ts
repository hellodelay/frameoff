/**
 * Service to keep the tablet screen awake even when no interaction is happening.
 * Uses the Screen Wake Lock API with auto-reacquisition on visibility change,
 * plus a fallback silent media element technique for browsers lacking native Wake Lock.
 */

type WakeLockSentinelType = any;

class ScreenWakeLockService {
  private sentinel: WakeLockSentinelType | null = null;
  private isRequested: boolean = false;
  private fallbackVideo: HTMLVideoElement | null = null;
  private listeners: Set<(active: boolean) => void> = new Set();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRequested) {
          this.requestNativeWakeLock();
        }
      });
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  public isActive(): boolean {
    return this.sentinel !== null || (this.fallbackVideo !== null && !this.fallbackVideo.paused);
  }

  public subscribe(callback: (active: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.isActive());
    return () => this.listeners.delete(callback);
  }

  private notify() {
    const active = this.isActive();
    this.listeners.forEach((cb) => cb(active));
  }

  public async enable(): Promise<boolean> {
    this.isRequested = true;
    const success = await this.requestNativeWakeLock();
    if (!success) {
      this.enableFallback();
    }
    this.notify();
    return this.isActive();
  }

  public async disable(): Promise<void> {
    this.isRequested = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('Error releasing wake lock:', err);
      }
      this.sentinel = null;
    }
    this.disableFallback();
    this.notify();
  }

  private async requestNativeWakeLock(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        this.notify();
      });
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Wake Lock request failed:', err?.message || err);
      return false;
    }
  }

  private enableFallback() {
    if (typeof document === 'undefined') return;
    if (!this.fallbackVideo) {
      // 1-second silent blank video data URI to prevent iOS Safari from sleeping
      const video = document.createElement('video');
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.muted = true;
      video.volume = 0;
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';
      // Inline base64 mp4 empty blank video frame
      video.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADpmcmVlAAAEbW1kYXQAAAAAAAAB/w==';
      document.body.appendChild(video);
      this.fallbackVideo = video;
    }

    this.fallbackVideo.play().catch(() => {
      // Autoplay might be blocked until user interacts
    });
  }

  private disableFallback() {
    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        this.fallbackVideo.remove();
      } catch (e) {}
      this.fallbackVideo = null;
    }
  }
}

export const wakeLockService = new ScreenWakeLockService();
