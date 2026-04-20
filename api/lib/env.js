/**
 * api/lib/env.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Environment variable validation.
 * Call validateEnv() once at server startup — before any handlers run.
 *
 * Behaviour:
 *   development  → throws immediately so the developer sees the error
 *   production   → logs all missing vars and calls process.exit(1)
 *
 * This avoids silent partial-startup where some routes work and others fail
 * with cryptic "undefined is not a string" errors deep in handler code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CRITICAL = [
  // Database
  'MONGODB_URI',
  // Payments — Cashfree
  'CASHFREE_APP_ID',
  'CASHFREE_SECRET_KEY',
];

const RECOMMENDED = [
  // Cashfree webhook (optional — server starts without it, but fake webhooks won't be rejected)
  'CASHFREE_WEBHOOK_SECRET',
  // Real-time (PS Drop feature)
  'PUSHER_APP_ID',
  'PUSHER_KEY',
  'PUSHER_SECRET',
  'PUSHER_CLUSTER',
  // Email
  'RESEND_API_KEY',
  // Admin auth
  'ADMIN_SECRET',
  'ADMIN_USER',
  // Note: ADMIN_PASS removed — password is stored as bcrypt hash in MongoDB Atlas
];

/**
 * Validate that all critical environment variables are present.
 * @throws {Error} in development if any critical vars are missing
 * Calls process.exit(1) in production if any critical vars are missing
 * Warns (but doesn't crash) for recommended vars
 */
export function validateEnv() {
  const missingCritical    = CRITICAL.filter((key) => !process.env[key]);
  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);

  // Warn about recommended vars (non-fatal)
  if (missingRecommended.length > 0) {
    const lines = missingRecommended.map((k) => `  ⚠ ${k}`).join('\n');
    console.warn(`[env] ⚠ Missing optional env vars (some features may be disabled):\n${lines}`);
  }

  if (missingCritical.length === 0) {
    console.log(`[env] ✓ All ${CRITICAL.length} critical env vars present.`);
    return;
  }

  const lines = missingCritical.map((k) => `  ✗ ${k}`).join('\n');
  const msg   = `Missing CRITICAL environment variables:\n${lines}`;

  if (process.env.NODE_ENV === 'production') {
    console.error(`\n[env] FATAL — server cannot start safely.\n${msg}\n`);
    console.error('[env] Set these in your Cloud Run / Vercel environment settings.');
    process.exit(1);
  } else {
    throw new Error(
      `\n\n[env] Missing env vars — add these to your .env file:\n${lines}\n\n` +
      `Copy .env.example to .env and fill in the values.\n`
    );
  }
}

/**
 * Safely read an env var, returning a fallback if missing.
 * Use for optional vars (e.g. PORT, NODE_ENV).
 */
export function env(key, fallback = '') {
  return process.env[key] ?? fallback;
}
