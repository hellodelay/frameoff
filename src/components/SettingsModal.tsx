import React, { useState } from 'react';
import {
  X,
  Sliders,
  Sun,
  Timer,
  Sparkles,
  RefreshCw,
  Eye,
  Key,
  LogOut,
  User,
  Info,
  Clock,
  Layers,
  HelpCircle,
  CheckCircle2,
  Lock,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { AuthUser, FitMode, FrameSettings, TransitionEffect } from '../types';
import { getEffectiveClientId, saveCustomClientId } from '../services/googlePhotos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FrameSettings;
  onUpdateSettings: (newSettings: Partial<FrameSettings>) => void;
  authUser: AuthUser | null;
  onSignOut: () => void;
  onConnectGoogle: () => void;
  isWakeLockActive: boolean;
  onClearAllData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  authUser,
  onSignOut,
  onConnectGoogle,
  isWakeLockActive,
  onClearAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'sync' | 'auth'>('display');
  const [customClientIdInput, setCustomClientIdInput] = useState<string>(() => getEffectiveClientId());
  const [clientIdSaved, setClientIdSaved] = useState<boolean>(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  if (!isOpen) return null;

  const speedPresets = [3, 5, 10, 15, 30, 60, 300];

  const transitionEffects: { id: TransitionEffect; label: string; desc: string }[] = [
    { id: 'kenburns', label: 'Ken Burns', desc: 'Slow, cinematic pan & zoom animation' },
    { id: 'crossfade', label: 'Crossfade', desc: 'Smooth, elegant dissolve' },
    { id: 'slide', label: 'Slide', desc: 'Horizontal slide transition' },
    { id: 'zoom', label: 'Zoom Fade', desc: 'Scale up and fade dissolve' },
    { id: 'flip', label: '3D Flip', desc: 'Subtle perspective flip effect' },
    { id: 'cut', label: 'Instant Cut', desc: 'Immediate change with zero delay' },
  ];

  const fitModes: { id: FitMode; label: string; desc: string }[] = [
    { id: 'fit-blur', label: 'Fit + Blur Backdrop', desc: 'Fit photo with blurred edges (Best for tablets)' },
    { id: 'cover', label: 'Fill Screen', desc: 'Edge-to-edge crop filling entire screen' },
    { id: 'contain', label: 'Contain', desc: 'Whole photo with solid black border' },
  ];

  const handleSaveClientId = () => {
    saveCustomClientId(customClientIdInput);
    onUpdateSettings({ googleClientId: customClientIdInput.trim() });
    setClientIdSaved(true);
    setTimeout(() => setClientIdSaved(false), 2500);
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="settings-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Frame Settings</h2>
              <p className="text-xs text-zinc-400">
                Configure tablet display, transition effects, and background sync
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 p-1 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs font-medium">
          <button
            id="tab-display"
            onClick={() => setActiveTab('display')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all ${
              activeTab === 'display'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Display & Transitions
          </button>
          <button
            id="tab-sync"
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all ${
              activeTab === 'sync'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sync & Wake Lock
          </button>
          <button
            id="tab-auth"
            onClick={() => setActiveTab('auth')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all ${
              activeTab === 'auth'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Google Login & Access
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-5 overflow-y-auto pr-1 flex-1 space-y-6 max-h-[60vh]">
          {/* 1. DISPLAY & TRANSITIONS TAB */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              {/* Transition Speed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-400" />
                    Transition Speed
                  </label>
                  <span className="text-xs font-mono bg-zinc-800 px-2.5 py-1 rounded-lg text-amber-400 font-semibold">
                    {settings.transitionSpeed < 60
                      ? `${settings.transitionSpeed} seconds`
                      : `${Math.round(settings.transitionSpeed / 60)} minutes`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {speedPresets.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => onUpdateSettings({ transitionSpeed: speed })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        settings.transitionSpeed === speed
                          ? 'bg-amber-500 text-zinc-950 font-semibold border-amber-400'
                          : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {speed < 60 ? `${speed}s` : `${speed / 60}m`}
                    </button>
                  ))}
                </div>

                <input
                  id="slider-transition-speed"
                  type="range"
                  min="3"
                  max="120"
                  step="1"
                  value={settings.transitionSpeed}
                  onChange={(e) => onUpdateSettings({ transitionSpeed: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                />
              </div>

              {/* Transition Effect */}
              <div>
                <label className="text-sm font-medium text-zinc-200 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Transition Effect
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {transitionEffects.map((effect) => {
                    const isSelected = settings.transitionEffect === effect.id;
                    return (
                      <div
                        key={effect.id}
                        onClick={() => onUpdateSettings({ transitionEffect: effect.id })}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                            : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{effect.label}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{effect.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Photo Fit Mode */}
              <div>
                <label className="text-sm font-medium text-zinc-200 flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Photo Framing / Fit Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {fitModes.map((mode) => {
                    const isSelected = settings.fitMode === mode.id;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => onUpdateSettings({ fitMode: mode.id })}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                            : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-zinc-800'
                        }`}
                      >
                        <span className="text-sm font-medium text-white block truncate">
                          {mode.label}
                        </span>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-tight">{mode.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ambient Overlays */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  On-Screen Overlays
                </h4>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <div>
                      <div className="text-sm font-medium text-white">Digital Clock & Date</div>
                      <div className="text-xs text-zinc-400">Shows current time in top-left corner</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showClock}
                    onChange={(e) => onUpdateSettings({ showClock: e.target.checked })}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-zinc-400" />
                    <div>
                      <div className="text-sm font-medium text-white">Photo Details & Date Taken</div>
                      <div className="text-xs text-zinc-400">Shows description and date in bottom-left corner</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showPhotoInfo}
                    onChange={(e) => onUpdateSettings({ showPhotoInfo: e.target.checked })}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. SYNC & WAKE LOCK TAB */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Screen Wake Lock */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 mt-0.5">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Keep Screen Awake (Wake Lock)</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Prevents tablet browser (iOS Safari, Android Chrome) from dimming or locking screen
                        while displaying photos.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 text-xs">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isWakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                          }`}
                        />
                        <span className={isWakeLockActive ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                          {isWakeLockActive
                            ? 'Screen Wake Lock active: Display will stay on'
                            : 'Wake lock inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={settings.keepScreenOn}
                    onChange={(e) => onUpdateSettings({ keepScreenOn: e.target.checked })}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Silent Background Album Polling */}
              <div>
                <label className="text-sm font-medium text-zinc-200 flex items-center gap-2 mb-1">
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  Background Album Auto-Sync
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Periodically inspects Google Photos to detect newly added or removed photos and silently updates
                  local storage without interrupting your slideshow.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { minutes: 0, label: 'Manual Only' },
                    { minutes: 15, label: 'Every 15m' },
                    { minutes: 30, label: 'Every 30m' },
                    { minutes: 60, label: 'Every 1 hr' },
                  ].map((preset) => (
                    <button
                      key={preset.minutes}
                      onClick={() => onUpdateSettings({ syncIntervalMinutes: preset.minutes })}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        settings.syncIntervalMinutes === preset.minutes
                          ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400'
                          : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700 text-xs font-medium'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tablet Browser Tips */}
              <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-400 space-y-2">
                <div className="flex items-center gap-2 font-medium text-zinc-200">
                  <Info className="w-4 h-4 text-blue-400" />
                  Tablet Setup Tips
                </div>
                <p>
                  <strong>iOS Safari:</strong> Tap the Share button in Safari and select <em>"Add to Home Screen"</em> to
                  launch this frame in borderless fullscreen web app mode.
                </p>
                <p>
                  <strong>Android Chrome:</strong> Tap the three-dot menu and select <em>"Install App"</em> or <em>"Add to Home Screen"</em>.
                </p>
              </div>
            </div>
          )}

          {/* 3. GOOGLE LOGIN & ANYONE ACCESS TAB */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              {/* Connected Account Card */}
              {authUser ? (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {authUser.picture ? (
                        <img
                          src={authUser.picture}
                          alt={authUser.name}
                          className="w-11 h-11 rounded-full border border-white/10"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                          {authUser.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-white">{authUser.name}</h4>
                        <p className="text-xs text-zinc-400">{authUser.email}</p>
                      </div>
                    </div>

                    <button
                      id="btn-sign-out"
                      onClick={onSignOut}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Lock className="w-3.5 h-3.5" />
                      Authentication Cached Offline
                    </span>
                    <span>Persistent Tablet Session</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-medium text-white">No Google Account Connected</h4>
                      <p className="text-xs text-zinc-400">Connect to access your Google Photos albums</p>
                    </div>
                  </div>
                  <button
                    onClick={onConnectGoogle}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-xl transition-colors shadow-md"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Anyone Can Authenticate Section */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      Allow Anyone to Authenticate
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      This app is configured for multi-user tablet usage. Any visitor can authenticate with their
                      own Google account. You can use the app's default Client ID or provide your own.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-medium text-zinc-300">
                    Google OAuth Client ID (Stored in Tablet Local Storage)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input-custom-client-id"
                      type="text"
                      placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                      value={customClientIdInput}
                      onChange={(e) => setCustomClientIdInput(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      id="btn-save-client-id"
                      onClick={handleSaveClientId}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium border border-zinc-700 transition-colors shrink-0"
                    >
                      Save
                    </button>
                  </div>
                  {clientIdSaved && (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Client ID saved to tablet!
                    </p>
                  )}
                </div>

                {/* Help button for setting up External Google OAuth */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowOAuthHelp(!showOAuthHelp)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 underline"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showOAuthHelp ? 'Hide Public OAuth Guide' : 'How to allow ANY Google account (External mode)'}
                  </button>

                  {showOAuthHelp && (
                    <div className="mt-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 space-y-2 leading-relaxed">
                      <p className="font-semibold text-white">How to configure Google Cloud Console:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-zinc-300">
                        <li>
                          In{' '}
                          <a
                            href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 underline"
                          >
                            APIs & Services &rarr; Library
                          </a>
                          , enable the <strong>Google Photos Picker API</strong>.
                        </li>
                        <li>
                          Open{' '}
                          <a
                            href="https://console.cloud.google.com/apis/credentials/consent"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 underline"
                          >
                            OAuth Consent Screen
                          </a>
                          : Select <strong>External</strong>, or if in Testing mode, add your email under <strong>Test users</strong>. Under Scopes, add <code>.../auth/photospicker.mediaitems.readonly</code>.
                        </li>
                        <li>
                          In <strong>Credentials</strong>, create an <strong>OAuth 2.0 Client ID</strong> (Application type: Web application).
                        </li>
                        <li>
                          Add this site's URL (<code>{window.location.origin}</code>) to <strong>Authorized JavaScript origins</strong>.
                        </li>
                        <li>
                          Copy the Client ID and paste it in the box above!
                        </li>
                      </ol>
                    </div>
                  )}
                </div>

                {/* Clear All Local Data Button */}
                {onClearAllData && (
                  <div className="pt-4 border-t border-zinc-800">
                    <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" /> Clear All Local Data
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Wipe photos, albums, credentials, and settings from this device.
                        </p>
                      </div>

                      {showClearConfirm ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setShowClearConfirm(false);
                              onClose();
                              onClearAllData();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                          >
                            Confirm Wipe
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 text-xs font-medium transition-colors shrink-0"
                        >
                          Clear All Data
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
