import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON and URL-encoded bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Photo proxy endpoint to bypass CORS and reliably cache blobs into IndexedDB on tablets
  app.get('/api/proxy-photo', async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url query parameter' });
      }

      // Basic validation to only proxy valid URLs (like Google Photos lh3.googleusercontent.com or images)
      const parsedUrl = new URL(targetUrl);
      // Allow Google Photos, Google CDNs, Unsplash, and standard image hosts
      const host = parsedUrl.hostname.toLowerCase();
      const isAllowedHost = 
        host.includes('google') ||
        host.includes('ggpht') ||
        host.includes('unsplash') ||
        host.includes('picsum.photos');

      if (!isAllowedHost) {
        return res.status(403).json({ error: 'Domain not allowed for proxying' });
      }

      // Forward Authorization header if provided by client (required by Google Photos Picker API baseUrls)
      const authHeader = req.headers['authorization'];
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      let response = await fetch(targetUrl, {
        headers,
        redirect: 'manual',
      });

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
          const redirectHeaders: Record<string, string> = {
            'User-Agent': headers['User-Agent'],
            Accept: headers['Accept'],
          };
          // Don't forward Authorization header if redirect location is already signed (avoids dual-auth rejection)
          if (authHeader && !redirectUrl.includes('x-goog-signature') && !redirectUrl.includes('Signature=')) {
            redirectHeaders['Authorization'] = authHeader;
          }
          response = await fetch(redirectUrl, {
            headers: redirectHeaders,
            redirect: 'follow',
          });
        }
      }

      if (!response.ok) {
        console.warn(`[Proxy Photo] Upstream error ${response.status} ${response.statusText} for URL: ${targetUrl.slice(0, 100)}...`);
        return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('Error proxying photo:', err);
      res.status(500).json({ error: 'Failed to proxy image', details: err?.message });
    }
  });

  // Google Photos Shared Album link resolver & photo extractor (supports GET and POST)
  const handleFetchSharedAlbum = async (req: express.Request, res: express.Response) => {
    // Enable CORS and disable caching
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      let rawUrl = '';

      // 1. Check POST body JSON or form
      if (req.body && typeof req.body.url === 'string' && req.body.url.trim()) {
        rawUrl = req.body.url.trim();
      } else if (req.body && typeof req.body.b64 === 'string' && req.body.b64.trim()) {
        try {
          const decoded = Buffer.from(req.body.b64.trim(), 'base64').toString('utf8');
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            rawUrl = decoded;
          }
        } catch {}
      }

      // 2. Check query.b64 parameter
      if (!rawUrl && req.query.b64 && typeof req.query.b64 === 'string') {
        try {
          let decoded = Buffer.from(req.query.b64.trim(), 'base64').toString('utf8');
          if (decoded.includes('%3A') || decoded.includes('%3a')) {
            try {
              decoded = decodeURIComponent(decoded);
            } catch {}
          }
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            rawUrl = decoded;
          }
        } catch {}
      }

      // 3. Check query.url parameter
      if (!rawUrl && req.query.url && typeof req.query.url === 'string') {
        rawUrl = req.query.url.trim();
      }

      // 4. Fallback: inspect originalUrl to capture full query string without Express query truncation
      if (!rawUrl && req.originalUrl.includes('/api/fetch-shared-album')) {
        const queryStart = req.originalUrl.indexOf('?');
        if (queryStart !== -1) {
          const qs = req.originalUrl.substring(queryStart + 1);
          const match = qs.match(/(?:url|b64)=([^&]+)/);
          if (match && match[1]) {
            try {
              rawUrl = decodeURIComponent(match[1]);
            } catch {
              rawUrl = match[1];
            }
          }
        }
      }

      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid shared album url' });
      }

      // If rawUrl is still URI-encoded, decode it
      if (rawUrl.includes('%3A') || rawUrl.includes('%3a')) {
        try {
          rawUrl = decodeURIComponent(rawUrl);
        } catch {}
      }

      // Convert any lingering encoded query separators %3F / %3f into real query strings
      if (rawUrl.includes('%3F') || rawUrl.includes('%3f')) {
        rawUrl = rawUrl.replace(/%3f/gi, '?').replace(/%3d/gi, '=').replace(/%26/gi, '&');
      }

      // Recombine key if proxy or query parser split it into a separate req.query.key param
      if (typeof req.query.key === 'string' && req.query.key && !rawUrl.includes('key=')) {
        rawUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}key=${req.query.key}`;
      }

      const trimmedUrl = rawUrl.trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(trimmedUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format. Please provide a valid Google Photos shared album link.' });
      }

      const host = parsedUrl.hostname.toLowerCase();
      if (!host.includes('photos.app.goo.gl') && !host.includes('photos.google.com')) {
        return res.status(400).json({
          error: 'Please enter a valid Google Photos link (e.g. https://photos.app.goo.gl/... or https://photos.google.com/share/...)',
        });
      }

      // Detect if user copied private library address bar URL instead of a share link
      const isPrivateAlbumUrl =
        trimmedUrl.includes('photos.google.com/album/') ||
        trimmedUrl.includes('/u/0/album/') ||
        trimmedUrl.includes('/u/1/album/') ||
        trimmedUrl.endsWith('/albums') ||
        trimmedUrl.endsWith('/albums/');

      if (isPrivateAlbumUrl && !trimmedUrl.includes('/share/')) {
        return res.status(400).json({
          error: 'This looks like an address bar link from your personal Google Photos library (photos.google.com/album/...). Google requires a Share Link: In Google Photos, open the album, click the Share icon (or Options ⋮) > "Create link" or "Copy link", then paste that link here!',
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      let targetUrl = trimmedUrl;

      // 1. If this is a shortened goo.gl link, resolve redirect
      if (host.includes('photos.app.goo.gl')) {
        try {
          const redirectRes = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'manual',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: controller.signal,
          });

          if (redirectRes.status >= 300 && redirectRes.status < 400) {
            const loc = redirectRes.headers.get('location');
            if (loc) {
              targetUrl = new URL(loc, targetUrl).toString();
            }
          }
        } catch (redirErr) {
          console.warn('[Fetch Shared Album] Short URL redirect note:', redirErr);
        }
      }

      // 2. Fetch target album HTML with desktop browser headers so Google Photos returns full SSR markup
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // If Google redirected to sign-in page, link sharing is not enabled on this album
      if (response.url && response.url.includes('accounts.google.com')) {
        return res.status(403).json({
          error: 'This album requires Google account sign-in or link sharing is restricted. In Google Photos, open the album, tap Share > "Create link", and paste the new public link here.',
        });
      }

      if (!response.ok) {
        return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
          error: `Google Photos returned status ${response.status} (${response.statusText}). Please check that link sharing is active for this album.`,
        });
      }

      const html = await response.text();

      // Extract album title
      let title = 'Shared Google Photos Album';
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = ogTitleMatch[1].replace(/ - Google Photos$/, '').trim();
      } else if (titleTagMatch && titleTagMatch[1]) {
        title = titleTagMatch[1].replace(/ - Google Photos$/, '').trim();
      }

      // Extract cover image
      let coverPhotoBaseUrl: string | undefined = undefined;
      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogImageMatch && ogImageMatch[1]) {
        coverPhotoBaseUrl = ogImageMatch[1].split('=')[0];
      }

      // Extract photo base URLs
      const photoUrls = new Set<string>();

      // 1. Primary pattern: unescaped pw URLs
      const pwRegex = /https:\/\/lh[0-9]\.googleusercontent\.com\/pw\/([a-zA-Z0-9_\-]+)/g;
      let match: RegExpExecArray | null;
      while ((match = pwRegex.exec(html)) !== null) {
        const baseId = match[1].split('=')[0];
        if (baseId.length >= 20) {
          photoUrls.add(`https://lh3.googleusercontent.com/pw/${baseId}`);
        }
      }

      // 2. JSON-escaped pw URLs
      const pwEscRegex = /https:\\\/\\\/lh[0-9]\.googleusercontent\.com\\\/pw\\\/([a-zA-Z0-9_\-]+)/g;
      while ((match = pwEscRegex.exec(html)) !== null) {
        const baseId = match[1].split('=')[0];
        if (baseId.length >= 20) {
          photoUrls.add(`https://lh3.googleusercontent.com/pw/${baseId}`);
        }
      }

      // 3. Secondary pattern: generic lh3/lh[0-9] images without /a/ (avatar) or /ogw/
      const generalRegex = /https:\/\/lh[0-9]\.googleusercontent\.com\/([a-zA-Z0-9_\-]{40,})/g;
      while ((match = generalRegex.exec(html)) !== null) {
        const rawId = match[1].split('=')[0];
        if (!rawId.startsWith('a/') && !rawId.startsWith('ogw/') && !rawId.startsWith('pw/')) {
          photoUrls.add(`https://lh3.googleusercontent.com/${rawId}`);
        }
      }

      const extractedUrls = Array.from(photoUrls);

      if (extractedUrls.length === 0) {
        return res.status(404).json({
          error:
            'No photos could be found in this album. Please check that the album contains photos and link sharing is active.',
        });
      }

      if (!coverPhotoBaseUrl && extractedUrls.length > 0) {
        coverPhotoBaseUrl = extractedUrls[0];
      }

      const photos = extractedUrls.map((url, idx) => ({
        id: `shared_${idx}_${url.slice(-16).replace(/[^a-zA-Z0-9]/g, '')}`,
        baseUrl: url,
        filename: `${title.replace(/[^a-zA-Z0-9-_ ]/g, '') || 'photo'}_${idx + 1}.jpg`,
      }));

      return res.json({
        success: true,
        title,
        coverPhotoBaseUrl,
        count: photos.length,
        photos,
        canonicalUrl: response.url || targetUrl,
      });
    } catch (err: any) {
      console.error('[Fetch Shared Album] Error:', err);
      res.status(500).json({ error: 'Failed to process shared album link', details: err?.message });
    }
  };

  app.options(['/api/fetch-shared-album', '/api/fetch-shared-album/'], (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(204);
  });
  app.get(['/api/fetch-shared-album', '/api/fetch-shared-album/'], handleFetchSharedAlbum);
  app.post(['/api/fetch-shared-album', '/api/fetch-shared-album/'], handleFetchSharedAlbum);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Photo Frame server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
