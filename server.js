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
import fs      from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

// ── Polyfills for ESM ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Import existing API handlers ─────────────────────────────────────────────
import createOrderHandler    from './api/create-order.js';
import verifyPaymentHandler  from './api/verify-payment.js';
import cashfreeWebhookHandler from './api/cashfree-webhook.js';
import paymentStatusHandler  from './api/payment-status.js';
import registerHandler        from './api/register.js';
import teamHandler            from './api/team.js';
import teamDashboardHandler   from './api/team-dashboard.js';
import spotifyHandler         from './api/spotify.js';

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
  registrationsListHandler,
  registrationUpdateHandler,
  registrationDeleteHandler,
} from './api/admin/registrations.js';
import {
  teamsListHandler,
  teamsGetHandler,
  teamsAddHandler,
  teamsImportHandler,
  teamsUpdateHandler,
  teamsDeleteHandler,
  generateCodesHandler,
  teamsGetByIdHandler,
  approveMentorshipHandler,
} from './api/admin/teams.js';
import {
  teamsViewHandler,
  teamPaymentOverrideHandler,
  teamMemberEditHandler,
  teamMentorToggleHandler,
} from './api/admin/teams-view.js';
import {
  getWinnersHandler,
  saveWinnersHandler,
  publishWinnersHandler,
  unpublishWinnersHandler,
  publicWinnersHandler,
} from './api/admin/winners.js';
import {
  getPendingEmailsHandler,
  sendBulkEmailsHandler,
} from './api/admin/emails.js';

// ── Import Submissions handlers ───────────────────────────────────────
import submitHandler           from './api/submissions/submit.js';
import listSubmissionsHandler  from './api/submissions/list.js';
import getSubmissionHandler    from './api/submissions/get.js';
import teamAuthHandler         from './api/auth/team.js';

// ── Import Mentorship handlers ────────────────────────────────────────────────
import optMentorshipHandler    from './api/mentorship/opt.js';

// ── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist');

// ── Security Headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent XSS attacks in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Remove server fingerprint
  res.removeHeader('X-Powered-By');
  next();
});

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Registration endpoint: max 10 submissions per IP per 15 minutes
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please wait 15 minutes and try again.' },
});

// Team code lookup: max 30 lookups per IP per 15 minutes
const teamLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please wait and try again.' },
});

// General API limiter: 200 requests per IP per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

// Apply general API limiter to all /api/* routes
app.use('/api/', apiLimiter);

// Parse JSON bodies — NOTE: webhook handler needs raw body for signature verification
// We use express.raw for the webhook route and express.json for everything else
app.use('/api/cashfree-webhook', express.raw({ type: 'application/json' }));
// Limit body size to 2MB to prevent payload bombs
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

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
  '/contact':            'contact.html',
  
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
  '/admin/submissions':        'admin/submissions.html',
  '/admin/teams':              'admin/team.html',
  '/admin/team':               'admin/team.html',
  '/admin/emails':             'admin/emails.html',
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
app.all('/api/create-order',      mountHandler(createOrderHandler));
app.all('/api/verify-payment',    mountHandler(verifyPaymentHandler));
app.post('/api/cashfree-webhook', mountHandler(cashfreeWebhookHandler));  // Cashfree payment events
app.get ('/api/payment-status',   mountHandler(paymentStatusHandler));    // Frontend polling after redirect
app.post('/api/register', registerLimiter,    mountHandler(registerHandler));
app.get ('/api/team',    teamLookupLimiter,  mountHandler(teamHandler));
app.get ('/api/team-dashboard',mountHandler(teamDashboardHandler));
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

// ── Admin Registrations API (reads from registrations collection) ─────────────
app.get   ('/api/admin/registrations',        mountHandler(registrationsListHandler));
app.patch ('/api/admin/registrations/:id',    mountHandler(registrationUpdateHandler));
app.delete('/api/admin/registrations/:id',    mountHandler(registrationDeleteHandler));

// ── Admin Bulk Emails API ─────────────────────────────────────────────────────
app.get ('/api/admin/emails/pending',   mountHandler(getPendingEmailsHandler));
app.post('/api/admin/emails/send-bulk', mountHandler(sendBulkEmailsHandler));

// ── Admin Teams API ───────────────────────────────────────────────────────────
// IMPORTANT: static paths (/import, /generate-codes, /view) must come BEFORE /:id
app.get   ('/api/admin/teams',                mountHandler(teamsListHandler));
app.get   ('/api/admin/teams/:id',            mountHandler(teamsGetHandler));
app.get   ('/api/admin/teams/view',           mountHandler(teamsViewHandler));       // panel
app.post  ('/api/admin/teams/import',         mountHandler(teamsImportHandler));
app.post  ('/api/admin/teams/generate-codes', mountHandler(generateCodesHandler));
app.post  ('/api/admin/teams',                mountHandler(teamsAddHandler));
app.patch ('/api/admin/teams/:id/payment',    mountHandler(teamPaymentOverrideHandler)); // payment override
app.patch ('/api/admin/teams/:id/member',     mountHandler(teamMemberEditHandler));       // member edit
app.patch ('/api/admin/teams/:id/mentor',     mountHandler(teamMentorToggleHandler));     // mentor toggle
app.get   ('/api/admin/teams/:id',            mountHandler(teamsGetByIdHandler));
app.post  ('/api/admin/teams/:id/approve-mentorship', mountHandler(approveMentorshipHandler));
app.patch ('/api/admin/teams/:id',            mountHandler(teamsUpdateHandler));
app.delete('/api/admin/teams/:id',            mountHandler(teamsDeleteHandler));

// ── Winners Admin API ─────────────────────────────────────────────────────────
app.get ('/api/admin/winners',            mountHandler(getWinnersHandler));
app.post('/api/admin/winners/save',       mountHandler(saveWinnersHandler));
app.post('/api/admin/winners/publish',    mountHandler(publishWinnersHandler));
app.post('/api/admin/winners/unpublish',  mountHandler(unpublishWinnersHandler));


// ── Submissions API ───────────────────────────────────────────────────────────
app.post('/api/submissions/submit', mountHandler(submitHandler));
app.get ('/api/submissions/list',   mountHandler(listSubmissionsHandler));
app.get ('/api/submissions/get',    mountHandler(getSubmissionHandler));
app.get ('/api/admin/submissions',  mountHandler(listSubmissionsHandler));

// ── Winners Public API ────────────────────────────────────────────────────────
app.get('/api/winners', mountHandler(publicWinnersHandler));

// ── Team Auth API ─────────────────────────────────────────────────────────────
app.post('/api/auth/team', mountHandler(teamAuthHandler));

// ── Mentorship API ────────────────────────────────────────────────────────────
app.post('/api/mentorship/opt', mountHandler(optMentorshipHandler));

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
  const page404 = path.join(DIST, '404.html');
  if (fs.existsSync(page404)) {
    res.status(404).sendFile(page404);
  } else {
    res.status(404).send('Not Found');
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ UDBHAV'26 server running on port ${PORT}`);
  console.log(`📦 Environment check:`);
  console.log(`   - MONGODB_URI:      ${process.env.MONGODB_URI      ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - CASHFREE_APP_ID:      ${process.env.CASHFREE_APP_ID      ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - CASHFREE_SECRET_KEY:  ${process.env.CASHFREE_SECRET_KEY  ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - CASHFREE_WEBHOOK_SEC: ${process.env.CASHFREE_WEBHOOK_SECRET ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - RESEND_API_KEY:   ${process.env.RESEND_API_KEY   ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - ADMIN_SECRET:     ${process.env.ADMIN_SECRET     ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - ADMIN_USER:       ${process.env.ADMIN_USER       ? '✓ Set' : '✗ Missing'}`);
  console.log(`   - Admin password:   ✓ Stored as bcrypt hash in MongoDB Atlas`);
});
