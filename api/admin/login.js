/**
 * api/admin/login.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/admin/login
 *
 * Validates admin credentials against MongoDB Atlas.
 * Passwords are stored as bcrypt hashes — never in plaintext.
 *
 * On success, returns the ADMIN_SECRET token which the client stores in
 * localStorage and sends as X-Admin-Secret on all subsequent admin API calls.
 *
 * Body:    { username: string, password: string }
 * Returns: { success: true, token }  |  { success: false, error }
 */

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { rateLimit, getIP } from '../lib/rateLimiter.js';

// ── Inline AdminUser model (avoids issues with model re-registration) ─────────
let AdminUser;
const getAdminUserModel = () => {
  if (AdminUser) return AdminUser;
  const schema = new mongoose.Schema(
    {
      username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
      role:         { type: String, default: 'admin' },
      lastLogin:    { type: Date },
    },
    { collection: 'adminusers' }
  );
  AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', schema);
  return AdminUser;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const ip = getIP(req);

  // Strict rate limit — 5 attempts per IP per 10 minutes
  if (!rateLimit(`admin:login:${ip}`, 5, 600)) {
    console.warn(`[admin/login] Rate limited: ${ip}`);
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Wait 10 minutes.',
    });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }

  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET) {
    console.error('[admin/login] ADMIN_SECRET not set in env');
    return res.status(500).json({ success: false, error: 'Server not configured.' });
  }

  // ── Look up admin user from MongoDB ──────────────────────────────────────────
  try {
    const Model = getAdminUserModel();
    const adminUser = await Model.findOne({ username: username.toLowerCase().trim() });

    if (!adminUser) {
      // Use a fake compare to prevent timing attacks (don't reveal user doesn't exist)
      await bcrypt.compare(password, '$2a$12$invalidhashtopreventtimingattacksonuserlookup');
      console.warn(`[admin/login] ❌ No such user: "${username}" from ${ip}`);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, adminUser.passwordHash);

    if (!passwordMatch) {
      console.warn(`[admin/login] ❌ Wrong password for "${username}" from ${ip}`);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // ── Success ───────────────────────────────────────────────────────────────
    // Update lastLogin timestamp (non-blocking)
    Model.findByIdAndUpdate(adminUser._id, { lastLogin: new Date() }).catch(() => {});

    console.log(`[admin/login] ✅ Admin login: ${username} from ${ip} at ${new Date().toISOString()}`);
    return res.status(200).json({ success: true, token: ADMIN_SECRET });

  } catch (err) {
    console.error(`[admin/login] DB error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
}
