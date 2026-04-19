/**
 * api/register.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/register
 *
 * Receives UDBHAV'26 Round 2 registration form data (after team-code verify),
 * saves it to MongoDB, and notifies the admin dashboard.
 *
 * Request body (JSON):
 *   {
 *     teamCode,                                     // verified team code
 *     teamName, collegeName, branch,                // auto-filled (read-only)
 *     leader: { name, email, phone },               // auto-filled
 *     members: [{ name, phone }, ...],              // 1–3 items (user-filled)
 *     mentorSession: boolean,
 *     totalAmount: number,
 *     paymentStatus: 'pending'
 *   }
 *
 * Response:
 *   200  { success: true, teamCode, teamName, leaderEmail, amountPaid, wantsMentor }
 *   400  { success: false, error: "<message>" }
 *   500  { success: false, error: "Internal server error" }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from './lib/mongodb.js';
import { Registration } from './models/Registration.js';
import { Team } from './models/Team.js';

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // ── 1. Basic validation ──────────────────────────────────────────────────
    if (!(body.teamCode  || '').trim()) return res.status(400).json({ success: false, error: 'Team code is required.' });
    if (!(body.teamName  || '').trim()) return res.status(400).json({ success: false, error: 'Team name is required.' });

    // Leader validation (auto-filled, so should always be present)
    if (!body.leader || !(body.leader.name || '').trim()) {
      return res.status(400).json({ success: false, error: 'Leader name is required.' });
    }

    // Members: at least 1, only name required
    const members = Array.isArray(body.members) ? body.members : [];
    if (members.length < 1) return res.status(400).json({ success: false, error: 'At least one team member is required.' });
    if (members.length > 3) return res.status(400).json({ success: false, error: 'Maximum 3 additional members allowed.' });

    for (let i = 0; i < members.length; i++) {
      if (!(members[i]?.name || '').trim()) {
        return res.status(400).json({ success: false, error: `Member ${i + 2}: name is required.` });
      }
    }

    // Amount sanity check
    const validAmounts = [800, 1100];
    const totalAmount  = Number(body.totalAmount);
    if (!validAmounts.includes(totalAmount)) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount.' });
    }

    // ── 2. Connect to MongoDB ────────────────────────────────────────────────
    await connectDB();

    // ── 3. Duplicate check (same teamCode already submitted) ─────────────────
    const existing = await Registration.findOne({
      teamCode: (body.teamCode || '').trim().toUpperCase(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This team has already completed registration. Contact support if unexpected.',
      });
    }

    // ── 4. Save registration ─────────────────────────────────────────────────
    const registration = await Registration.create({
      teamCode:    (body.teamCode || '').trim().toUpperCase(),
      teamName:    (body.teamName || '').trim(),
      collegeName: (body.collegeName || '').trim(),
      branch:      (body.branch || '').trim(),
      yearOfStudy: (body.yearOfStudy || '').toString().trim() || 'N/A',
      leader: {
        name:  (body.leader.name  || '').trim(),
        email: (body.leader.email || '').trim().toLowerCase(),
        phone: (body.leader.phone || '').trim(),
      },
      members: members.map((m) => ({
        name:  (m.name  || '').trim(),
        email: (m.email || '').trim().toLowerCase(),
        phone: (m.phone || '').trim(),
      })),
      mentorSession: Boolean(body.mentorSession),
      totalAmount,
      paymentStatus: 'pending',   // admin verifies WhatsApp screenshot → marks paid
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // ── 4.5. Update the existing Team document ───────────────────────────────
    // The admin dashboard reads from the 'teams' collection.
    // We update the team document with the members and mentor selection immediately.
    await Team.findOneAndUpdate(
      { code: (body.teamCode || '').trim().toUpperCase() },
      { 
        $set: { 
          members: members.map((m) => ({
            name:  (m.name  || '').trim(),
            phone: (m.phone || '').trim(),
          })),
          memberCount: members.length + 1, // leader + members
          mentorSession: Boolean(body.mentorSession),
          totalAmount: totalAmount,
        }
      }
    );

    // ── 5. Respond with data needed by the success screen ────────────────────
    return res.status(200).json({
      success:     true,
      id:          registration._id.toString(),
      teamCode:    registration.teamCode,
      teamName:    registration.teamName,
      leaderEmail: registration.leader.email,
      amountPaid:  registration.totalAmount,
      wantsMentor: registration.mentorSession,
      message:     'Registration saved! Send your payment screenshot on WhatsApp.',
    });

  } catch (err) {
    console.error('[/api/register] Error:', err);

    // Mongoose duplicate key (race condition)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'This team is already registered.' });
    }

    return res.status(500).json({
      success: false,
      error: 'Server error — please try again in a moment.',
    });
  }
}

