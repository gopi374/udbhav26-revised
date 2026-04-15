/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express server for Google Cloud Run.
 * - Serves the Vite-built static files from /dist
 * - Mounts all API handlers under /api/*
 * - Handles clean URL rewrites (no .html extension needed)
 * - Falls back to 404.html for unknown routes
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ── Polyfills for ESM ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Import API handlers ──────────────────────────────────────────────────────
import createOrderHandler  from './api/create-order.js';
import verifyPaymentHandler from './api/verify-payment.js';
import registerHandler      from './api/register.js';
import teamHandler          from './api/team.js';
import spotifyHandler       from './api/spotify.js';

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist');

// Parse JSON bodies (required for API handlers)
app.use(express.json());

// ── Clean-URL mapping ─────────────────────────────────────────────────────────
// Map /pagename → dist/pagename.html (mirrors vercel.json rewrites)
const cleanRoutes = {
  '/about':              'about.html',
  '/work':               'work.html',
  '/blog':               'blog.html',
  '/blog-post':          'blog-post.html',
  '/links':              'links.html',
  '/uses':               'uses.html',
  '/playground':         'playground.html',
  '/jamify':             'jamify.html',
  '/book-a-call':        'book-a-call.html',
  '/register':           'register.html',
  '/admin/login':        'admin/login.html',
  '/admin/dashboard':    'admin/dashboard.html',
  '/admin/registrations':'admin/registrations.html',
};

// ── Vercel-handler adapter ────────────────────────────────────────────────────
// Our API handlers use Vercel's (req, res) interface.
// Express req/res is compatible — just pass through directly.
function mountHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('Unhandled handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  };
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.all('/api/create-order',   mountHandler(createOrderHandler));
app.all('/api/verify-payment', mountHandler(verifyPaymentHandler));
app.all('/api/register',       mountHandler(registerHandler));
app.all('/api/team',           mountHandler(teamHandler));
app.all('/api/spotify',        mountHandler(spotifyHandler));

// ── Clean URL Routes ──────────────────────────────────────────────────────────
for (const [route, file] of Object.entries(cleanRoutes)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(DIST, file));
  });
}

// ── Static files (JS, CSS, images, etc.) ─────────────────────────────────────
app.use(express.static(DIST, {
  extensions: ['html'],
  index:      'index.html',
}));

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ── 404 Fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(DIST, '404.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ UDBHAV'26 server running on port ${PORT}`);
});
