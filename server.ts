import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

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
