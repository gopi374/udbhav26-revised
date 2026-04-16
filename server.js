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

// ── Load environment variables ───────────────────────────────────────────────
import dotenv from 'dotenv';
dotenv.config();

// ── Validate required env vars before anything else ──────────────────────────
import { validateEnv } from './api/lib/env.js';
validateEnv();

import express from 'express';
import path    from 'path';
import { fileURLToPath } from 'url';

// ── Polyfills for ESM ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Import existing API handlers ─────────────────────────────────────────────
import createOrderHandler  from './api/create-order.js';
import verifyPaymentHandler from './api/verify-payment.js';
import registerHandler      from './api/register.js';
import teamHandler          from './api/team.js';
import spotifyHandler       from './api/spotify.js';

// ── Import PS Drop handlers ──────────────────────────────────────────────────
import psStatusHandler     from './api/ps/status.js';
import psVerifyHandler     from './api/ps/verify-code.js';
import psListHandler       from './api/ps/list.js';
import psSelectHandler     from './api/ps/select.js';
import {
  configHandler,
  addPsHandler,
  updatePsHandler,
  deletePsHandler,
  startDropHandler,
  stopDropHandler,
  statsHandler,
} from './api/admin/ps.js';
import adminLoginHandler from './api/admin/login.js';
import { paymentsHandler } from './api/admin/payments.js';
import { psStatsHandler }  from './api/admin/ps-stats.js';
import {
  getWinnersHandler,
  saveWinnersHandler,
  publishWinnersHandler,
  unpublishWinnersHandler,
  publicWinnersHandler,
} from './api/admin/winners.js';

// ── Import Submissions handlers ────────────────────────────────────────────────
import submitHandler from './api/submissions/submit.js';
import listHandler   from './api/submissions/list.js';

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist');

// Parse JSON bodies
app.use(express.json());

// ── Clean-URL mapping (Combined Portfolio + Udbhav Hackathon) ────────────────
const cleanRoutes = {
  // Public Pages
  '/about':             'about.html',
  '/schedule':          'schedule.html',
  '/problem-statement': 'problem-statement.html',
  '/ps':                'problem-statement.html', // Alias
  '/winners':           'winners.html',
  '/sponsors':          'sponsors.html',
  '/code-of-conduct':   'code-of-conduct.html',
  '/our-team':          'our-team.html',
  '/register':          'register.html',
  '/dashboard':         'user-dashboard.html',
  
  // Portfolio/Personal Pages
  '/work':              'work.html',
  '/blog':              'blog.html',
  '/blog-post':         'blog-post.html',
  '/links':             'links.html',
  '/uses':              'uses.html',
  '/playground':        'playground.html',
  '/jamify':            'jamify.html',
  '/book-a-call':       'book-a-call.html',
  '/legal':             'legal.html',

  // Admin Pages
  '/admin/login':        'admin/login.html',
  '/admin/dashboard':    'admin/dashboard.html',
  '/admin/registrations':'admin/registrations.html',
  '/admin/submissions':  'admin/submissions.html',
  '/admin/problem-statements': 'admin/problem-statements.html',
  '/admin/payments':           'admin/payments.html',
  '/admin/ps-stats':           'admin/ps-stats.html',
  '/admin/winners':            'admin/winners.html',
};

// ── Vercel-handler adapter ────────────────────────────────────────────────────
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

// ── Existing API Routes ───────────────────────────────────────────────────────
app.all('/api/create-order',   mountHandler(createOrderHandler));
app.all('/api/verify-payment', mountHandler(verifyPaymentHandler));
app.all('/api/register',       mountHandler(registerHandler));
app.all('/api/team',           mountHandler(teamHandler));
app.all('/api/spotify',        mountHandler(spotifyHandler));

// ── PS Drop Public API ────────────────────────────────────────────────────────
app.get ('/api/ps/status',      mountHandler(psStatusHandler));
app.post('/api/ps/verify-code', mountHandler(psVerifyHandler));
app.get ('/api/ps/list',        mountHandler(psListHandler));
app.post('/api/ps/select',      mountHandler(psSelectHandler));

// ── PS Drop Admin API ─────────────────────────────────────────────────────────
app.post('/api/admin/login',      mountHandler(adminLoginHandler));
app.post  ('/api/admin/ps/config',      mountHandler(configHandler));
app.post  ('/api/admin/ps/add-ps',      mountHandler(addPsHandler));
app.patch ('/api/admin/ps/update-ps',  mountHandler(updatePsHandler));
app.delete('/api/admin/ps/delete-ps',  mountHandler(deletePsHandler));
app.post  ('/api/admin/ps/start-drop', mountHandler(startDropHandler));
app.post  ('/api/admin/ps/stop-drop',  mountHandler(stopDropHandler));
app.get   ('/api/admin/ps/stats',      mountHandler(statsHandler));
app.get   ('/api/admin/payments',      mountHandler(paymentsHandler));
app.get   ('/api/admin/ps-stats',         mountHandler(psStatsHandler));

// ── Winners Admin API ─────────────────────────────────────────────────────────
app.get ('/api/admin/winners',            mountHandler(getWinnersHandler));
app.post('/api/admin/winners/save',       mountHandler(saveWinnersHandler));
app.post('/api/admin/winners/publish',    mountHandler(publishWinnersHandler));
app.post('/api/admin/winners/unpublish',  mountHandler(unpublishWinnersHandler));

// ── Winners Public API ────────────────────────────────────────────────────────
app.get('/api/winners', mountHandler(publicWinnersHandler));

// ── Submissions API ───────────────────────────────────────────────────────────
app.post('/api/submissions/submit', mountHandler(submitHandler));
app.get ('/api/submissions/list',   mountHandler(listHandler));

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
  console.log(`📦 Environment check:`);
  console.log(`   - MONGODB_URI:      ${process.env.MONGODB_URI      ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - RAZORPAY_KEY_ID:  ${process.env.RAZORPAY_KEY_ID  ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - PUSHER_APP_ID:    ${process.env.PUSHER_APP_ID    ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - RESEND_API_KEY:   ${process.env.RESEND_API_KEY   ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - ADMIN_SECRET:     ${process.env.ADMIN_SECRET     ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - ADMIN_USER:       ${process.env.ADMIN_USER       ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - ADMIN_PASS:       ${process.env.ADMIN_PASS       ? '✓ Set' : '✗ Missing'}`);
});