# Google Photos Digital Frame 🖼️

An offline-first, tablet-optimized digital photo frame web application for Google Photos albums. Designed for wall-mounted tablets, iPads, and desktop displays with smooth transitions, offline IndexedDB photo caching, automatic background sync, and screen wake lock.

---

## ✨ Features

- **Google Photos Integration**: Connect your Google account using Google Identity Services (GIS) to browse and stream your personal or shared albums.
- **100% Offline Playback**: Photos are downloaded and stored locally in browser IndexedDB as binary blobs. After an album is cached, the photo frame runs continuously without internet connectivity.
- **Silky Smooth Transitions**: Hardware-accelerated GPU transitions with `motion/react`:
  - **Ken Burns**: Continuous, cinematic pan and zoom synchronized to slide intervals.
  - **Crossfade**: Zero-flash dual-layer crossfading.
  - **Slide, Zoom, & 3D Flip**: Responsive transitions with directional awareness.
- **Ambient Blurred Backdrop**: In `fit-blur` mode, vertical or square photos on widescreen tablets display an ambient blurred backdrop to eliminate black bars.
- **Subtle Bottom Progress Bar**: A non-intrusive hairline progress indicator showing countdown to the next photo.
- **Screen Wake Lock**: Prevents tablet screens from dimming or sleeping using the Screen Wake Lock API and fallback keep-alive audio loops.
- **Background Auto-Sync**: Silently queries Google Photos for newly added or updated album media without interrupting active playback.
- **Tablet Gestures & Controls**: Touch swipe left/right to browse, tap anywhere to reveal floating controls that auto-hide after 4.5 seconds.
- **Zero Configuration Demo**: Ships with a pre-cached offline showcase album so you can test the frame instantly without logging into Google.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0 or higher
- `npm` (v9+) or `bun` / `pnpm`

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/google-photos-digital-frame.git
   cd google-photos-digital-frame
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables (optional):**
   ```bash
   cp .env.example .env
   ```
   *(You can also enter your Google Client ID directly in the on-screen Settings UI on the tablet!)*

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Production Build & Run

To build the optimized client bundle and compile the Express backend proxy:

```bash
# Build Vite client and bundle server.cjs with esbuild
npm run build

# Launch the production server
npm start
```

The application will listen on port `3000`.

---

## 🐳 Docker Deployment

A production-ready `Dockerfile` is included. You can build and run with Docker:

```bash
# Build the Docker image
docker build -t digital-photo-frame .

# Run the container
docker run -p 3000:3000 digital-photo-frame
```

---

## ☁️ Cloud Deployment Options

### 1. Google Cloud Run / Container Hosting
You can deploy directly using Cloud Run or Docker-based hosts:
```bash
gcloud run deploy digital-photo-frame \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 2. Render / Railway / Fly.io
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `3000`

---

## 🔑 Google Photos OAuth Setup Guide

To enable anyone to connect their personal Google account to this frame:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Digital Photo Frame`).
3. Under **APIs & Services &rarr; Library**, enable the **Photos Library API**.
4. Under **APIs & Services &rarr; OAuth Consent Screen**:
   - Select **External** user type (so any Google account can log in).
   - Add app name and support email.
   - Add the scope: `https://www.googleapis.com/auth/photoslibrary.readonly`.
5. Under **APIs & Services &rarr; Credentials**:
   - Click **Create Credentials &rarr; OAuth client ID**.
   - Application type: **Web application**.
   - Add your domain URL (e.g., `https://your-domain.com` or `http://localhost:3000`) under **Authorized JavaScript origins**.
6. Copy the generated **Client ID** and either:
   - Paste it into the in-app **Settings &rarr; Google Login & Access** modal on your tablet, OR
   - Set `VITE_GOOGLE_CLIENT_ID` in your `.env` file.

---

## 📱 Tablet Setup Tips

1. **Add to Home Screen (PWA mode)**:
   - On **iPad / iOS Safari**: Tap the Share button &rarr; *Add to Home Screen* to run in full-screen standalone mode without browser toolbars.
   - On **Android / Chrome**: Tap the three-dot menu &rarr; *Install app* or *Add to Home Screen*.
2. **Keep Screen On**:
   - Ensure the "Keep Screen Awake" toggle is enabled in Settings (on by default).
   - For dedicated kiosk tablets, set your tablet's system Auto-Lock / Screen Timeout setting to "Never" while plugged into power.

---

## 📄 License

MIT License. Feel free to use, modify, and deploy for personal or commercial use.
