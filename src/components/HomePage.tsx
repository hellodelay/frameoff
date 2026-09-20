import React, { useState, useRef } from 'react';
import {
  Image,
  Play,
  LogOut,
  FolderOpen,
  Sliders,
  Sun,
  Wifi,
  WifiOff,
  UserPlus,
  ExternalLink,
  ShieldCheck,
  Key,
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
  Trash2,
  Lock,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Album, AuthUser, FrameSettings } from '../types';
import { getEffectiveClientId, saveCustomClientId, sanitizeClientId } from '../services/googlePhotos';

interface HomePageProps {
  authUser: AuthUser | null;
  onConnectGoogle: (switchUser?: boolean) => void;
  onSignOut: () => void;
  hasPhotosAvailable: boolean;
  currentAlbum: Album | null;
  photoCount: number;
  onReturnToFrame: () => void;
  onOpenAlbums: () => void;
  onOpenSettings: () => void;
  onClearAllData: () => void;
  storageStats: { totalCount: number; totalBytes: number };
  settings: FrameSettings;
  onUpdateSettings: (newSettings: Partial<FrameSettings>) => void;
  isOnline: boolean;
  isWakeLockActive: boolean;
  onStartGooglePicker?: () => Promise<void>;
  onImportLocalPhotos?: (files: FileList | File[], title?: string) => Promise<void>;
  albumFetchError?: string | null;
  isPickingGooglePhotos?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  authUser,
  onConnectGoogle,
  onSignOut,
  hasPhotosAvailable,
  currentAlbum,
  photoCount,
  onReturnToFrame,
  onOpenAlbums,
  onOpenSettings,
  onClearAllData,
  storageStats,
  settings,
  onUpdateSettings,
  isOnline,
  isWakeLockActive,
  onStartGooglePicker,
  onImportLocalPhotos,
  albumFetchError,
  isPickingGooglePhotos,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customKeyInput, setCustomKeyInput] = useState<string>(() => {
    return settings.googleClientId || getEffectiveClientId() || '';
  });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);

  const effectiveClientId = settings.googleClientId || getEffectiveClientId();
  const hasValidClientId =
    effectiveClientId &&
    effectiveClientId.trim().length > 0 &&
    !effectiveClientId.includes('YOUR_GOOGLE_CLIENT_ID');

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeClientId(customKeyInput);
    saveCustomClientId(sanitized);
    onUpdateSettings({ googleClientId: sanitized });
    setCustomKeyInput(sanitized);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearClientId = () => {
    saveCustomClientId('');
    onUpdateSettings({ googleClientId: '' });
    setCustomKeyInput('');
  };

  const formatMegabytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      id="digital-frame-homepage"
      className="min-h-screen w-full bg-zinc-950 text-zinc-100 overflow-y-auto overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200"
    >
      {/* Hidden file input for uploading local photos or folders */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && onImportLocalPhotos) {
            onImportLocalPhotos(e.target.files);
          }
        }}
      />

      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-950/25 via-zinc-950 to-zinc-950" />

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/30 flex items-center justify-center shadow-inner">
            <Image className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Pictorial
            </h1>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Offline-first digital photo frame with Google Photos auto-sync
            </p>
          </div>
        </div>

        {/* Status badges & settings trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Wake lock indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
            title="Screen Wake Lock keeps display awake"
          >
            <Sun className={`w-3.5 h-3.5 ${isWakeLockActive ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span className="hidden md:inline">{isWakeLockActive ? 'Awake' : 'Sleep enabled'}</span>
          </div>

          {/* Network status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
            title={isOnline ? 'Online mode active' : 'Offline - playing from local cache'}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Settings button */}
          <button
            id="btn-home-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
            title="Display & Frame Settings"
            aria-label="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* HERO: Return to Album View (Always available, defaults to demo album if no photo data) */}
        <div
          id="card-return-to-album"
          className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-2xl transition-all"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {hasPhotosAvailable ? (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Photos Cached & Ready
                  </>
                ) : (
                  <>
                    <Layers className="w-3 h-3 text-amber-400" />
                    Demo Album Ready
                  </>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {hasPhotosAvailable && currentAlbum ? currentAlbum.title : 'Photo Frame Slideshow'}
              </h2>
              <p className="text-sm text-zinc-300 max-w-xl leading-relaxed">
                {hasPhotosAvailable
                  ? photoCount > 0
                    ? `${photoCount} photos loaded locally in high resolution with smooth ${settings.transitionEffect} transitions.`
                    : `${storageStats.totalCount} photos stored in offline cache.`
                  : 'No custom photos cached yet. Launching the frame will automatically load the high-resolution nature demo album with Ken Burns pan & zoom, clock overlays, and touch controls.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                id="btn-return-to-album"
                onClick={onReturnToFrame}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-zinc-950" />
                Return to Album View
              </button>
            </div>
          </div>
        </div>

        {/* GOOGLE ACCOUNT & AUTHENTICATION SECTION */}
        <section
          id="section-google-auth"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Google Account & Photos
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                {authUser
                  ? 'Manage your active Google Photos connection or switch to another user.'
                  : 'Connect your Google account to sync and cache personal albums on this device.'}
              </p>
            </div>

            {authUser && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            )}
          </div>

          {/* If user is authenticated */}
          {authUser ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                {authUser.picture ? (
                  <img
                    src={authUser.picture}
                    alt={authUser.name}
                    className="w-14 h-14 rounded-full border border-zinc-700 object-cover shadow"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-lg">
                    {authUser.name?.charAt(0) || 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-white truncate">{authUser.name}</h4>
                  <p className="text-xs sm:text-sm text-zinc-400 truncate">{authUser.email}</p>
                  <p className="text-xs text-zinc-500 mt-1">Google Photos Read-Only Access Active</p>
                </div>
              </div>

              {/* Action Buttons for Logged-In User */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  id="btn-pick-google-photos-home"
                  onClick={onStartGooglePicker}
                  disabled={isPickingGooglePhotos}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-60 col-span-1 sm:col-span-2"
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
                      <span>Pick from Google Photos</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-choose-album-home"
                  onClick={onOpenAlbums}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm border border-zinc-700 transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  Choose Albums
                </button>

                <button
                  id="btn-upload-local-photos-home"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium text-sm border border-zinc-700 transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Upload Photos
                </button>

                <button
                  id="btn-switch-user-home"
                  onClick={() => onConnectGoogle(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm border border-zinc-800 transition-colors"
                  title="Sign in with a different Google account"
                >
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  Switch User
                </button>

                <button
                  id="btn-signout-home"
                  onClick={onSignOut}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 font-medium text-sm border border-zinc-800 hover:border-rose-900/50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>

              {/* Diagnostic Banner if Google Photos API returned 403 or disabled */}
              {albumFetchError && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Google Photos API Status & Solution</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Google has replaced direct album listing with the <strong>Google Photos Picker API</strong>. Click the golden <strong>"Pick from Google Photos"</strong> button above to select your photos or whole albums securely with Google's official interface!
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    <span>If you haven't enabled the Picker API in Google Cloud Console yet:</span>
                    <a
                      href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Enable Google Photos Picker API <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* If user is NOT authenticated */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-medium text-white">
                    Sign in with your Google Account
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
                    Connect to pick photos or albums directly from your Google Photos library.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    id="btn-google-login-home"
                    onClick={() => onConnectGoogle(false)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] shrink-0"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Sign in with Google
                  </button>

                  <button
                    id="btn-upload-local-photos-guest"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium text-sm border border-zinc-700 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    Upload Device Photos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECURE CLIENT ID CONFIGURATION */}
          <div
            id="card-client-id-config"
            className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-white">Google OAuth Client ID</h4>
                {hasValidClientId ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1 text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" /> Required for Google Sign-In
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Stored locally in this browser</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              To connect your personal Google Photos library, provide your Web OAuth Client ID created in the{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
              . The ID is stored strictly in your browser's private local storage. Ensure your app URL is listed under <strong>Authorized JavaScript origins</strong>.
            </p>

            <form onSubmit={handleSaveClientId} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="input-homepage-client-id"
                  type="text"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono transition-colors"
                />
                <button
                  id="btn-save-homepage-client-id"
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-xl transition-all shadow hover:shadow-amber-500/20 shrink-0"
                >
                  {saveSuccess ? 'Saved to Browser!' : 'Save Client ID'}
                </button>
                {hasValidClientId && (
                  <button
                    id="btn-clear-client-id"
                    type="button"
                    onClick={handleClearClientId}
                    className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs rounded-xl border border-zinc-800 transition-colors shrink-0"
                    title="Remove custom client ID"
                  >
                    Remove
                  </button>
                )}
              </div>
              {saveSuccess && (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Client ID validated and stored safely in local browser storage.
                </p>
              )}
            </form>

            {/* Verification Troubleshooting Accordion */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                id="btn-toggle-oauth-troubleshooting"
                type="button"
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                className="w-full flex items-center justify-between text-xs text-amber-400/90 hover:text-amber-300 transition-colors py-1 font-medium text-left"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Fix error: &quot;Google has not completed verification process&quot; / &quot;Access blocked&quot;
                </span>
                {showTroubleshooting ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {showTroubleshooting && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-900/90 border border-amber-500/20 text-xs text-zinc-300 space-y-3">
                  <p className="text-amber-300 font-medium">
                    Because your app is in testing mode, Google requires authorized test users:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                    <li>
                      Go to{' '}
                      <a
                        href="https://console.cloud.google.com/apis/credentials/consent"
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 underline inline-flex items-center gap-0.5"
                      >
                        OAuth consent screen <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      in Google Cloud Console.
                    </li>
                    <li>
                      Scroll down to the <strong>&quot;Test users&quot;</strong> section.
                    </li>
                    <li>
                      Click <strong>&quot;+ ADD USERS&quot;</strong> and type the exact Google account email you are signing in with.
                    </li>
                    <li>
                      Click <strong>Save</strong>. You can now sign in!
                    </li>
                  </ol>
                  <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400">
                    <strong>Tip:</strong> If you see a warning screen saying <em>&quot;Google hasn&apos;t verified this app&quot;</em>, click <strong>Advanced</strong> at the bottom left, then click <strong>&quot;Go to hellodelay.github.io (unsafe)&quot;</strong> to approve access.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* LOCAL OFFLINE STORAGE & STATS */}
        <section
          id="section-offline-storage-stats"
          className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-400" />
              Device Cache & System Status
            </h4>
            <span className="text-xs text-zinc-500">IndexedDB Blob Storage</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] font-medium text-zinc-400">Offline Photos</p>
              <p className="text-lg font-bold text-white mt-0.5">{storageStats.totalCount}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] font-medium text-zinc-400">Cache Size</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {formatMegabytes(storageStats.totalBytes)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] font-medium text-zinc-400">Display Wake Lock</p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  isWakeLockActive ? 'text-amber-400' : 'text-zinc-500'
                }`}
              >
                {isWakeLockActive ? 'Active' : 'Off'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[11px] font-medium text-zinc-400">Network State</p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  isOnline ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </section>

        {/* DANGER ZONE / DATA RESET SECTION */}
        <section
          id="section-clear-all-data"
          className="rounded-2xl border border-rose-950/40 bg-gradient-to-br from-rose-950/15 via-zinc-950 to-zinc-950 p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Clear All Local Data
              </h4>
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                Permanently deletes all cached photos, albums, Google credentials, custom Client ID, and restores all frame preferences back to factory defaults.
              </p>
            </div>

            <button
              id="btn-clear-all-data"
              onClick={() => setShowClearConfirmModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-900/50 text-xs font-semibold transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Local Data
            </button>
          </div>
        </section>
      </main>

      {/* Confirmation Modal for Clearing All Local Data */}
      {showClearConfirmModal && (
        <div
          id="modal-confirm-clear-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowClearConfirmModal(false)}
        >
          <div
            id="modal-confirm-clear-box"
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Wipe All Local Data?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  This will completely clear your device's IndexedDB photo cache, remove your Google login and OAuth Client ID, and reset all frame display settings to defaults.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-cancel-clear-data"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-clear-data"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  onClearAllData();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-rose-600/20"
              >
                Yes, Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
