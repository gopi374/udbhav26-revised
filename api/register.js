/**
 * api/register.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — POST /api/register
 *
 * Receives UDBHAV'26 Round 2 registration form data, validates it,
 * and saves to MongoDB Atlas.
 *
 * Request body (JSON):
 *   {
 *     teamName, collegeName, branch, yearOfStudy,
 *     leader: { name, email, phone },
 *     members: [{ name, email, phone }, ...],   // 1–3 items
 *     mentorSession: boolean,
 *     totalAmount: number
 *   }
 *
 * Response:
 *   200  { success: true, id: "<mongo _id>", message: "Registration saved!" }
 *   400  { success: false, error: "<validation message>" }
 *   405  Method not allowed
 *   500  { success: false, error: "Internal server error" }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }    from './lib/mongodb.js';
import { Registration } from './models/Registration.js';

// ── Simple helpers ──────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
const isValidPhone = (v) => /^(\+91[\s-]?)?[6-9]\d{9}$/.test((v || '').replace(/\s/g, ''));

function validateMember(m, label) {
  if (!m || typeof m !== 'object') return `${label}: missing data`;
  if (!(m.name || '').trim())           return `${label}: name is required`;
  if (!isValidEmail(m.email))           return `${label}: valid email required`;
  if (!(m.phone || '').trim())          return `${label}: phone is required`;
  return null;
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS — allow only same origin (tighten in production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // ── 1. Field validation ─────────────────────────────────────────────────
    if (!(body.teamName    || '').trim()) return res.status(400).json({ success: false, error: 'Team name is required.' });
    if (!(body.collegeName || '').trim()) return res.status(400).json({ success: false, error: 'College name is required.' });
    if (!(body.branch      || '').trim()) return res.status(400).json({ success: false, error: 'Branch is required.' });
    if (!(body.yearOfStudy || '').trim()) return res.status(400).json({ success: false, error: 'Year of study is required.' });

    // Leader validation
    const leaderErr = validateMember(body.leader, 'Leader');
    if (leaderErr) return res.status(400).json({ success: false, error: leaderErr });

    // Members validation (at least 1 required)
    const members = Array.isArray(body.members) ? body.members : [];
    if (members.length < 1) return res.status(400).json({ success: false, error: 'At least one team member is required.' });
    if (members.length > 3) return res.status(400).json({ success: false, error: 'Maximum 3 additional members allowed.' });

    for (let i = 0; i < members.length; i++) {
      const err = validateMember(members[i], `Member ${i + 2}`);
      if (err) return res.status(400).json({ success: false, error: err });
    }

    // Amount sanity check
    const validAmounts = [800, 1100];
    const totalAmount  = Number(body.totalAmount);
    if (!validAmounts.includes(totalAmount)) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount.' });
    }

    // ── 2. Connect to MongoDB ───────────────────────────────────────────────
    await connectDB();

    // ── 3. Duplicate check (same teamName + leader email) ──────────────────
    const existing = await Registration.findOne({
      teamName: body.teamName.trim(),
      'leader.email': body.leader.email.trim().toLowerCase(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A registration with this team name and leader email already exists.',
      });
    }

    // ── 4. Save registration ────────────────────────────────────────────────
    const registration = await Registration.create({
      teamName:    body.teamName.trim(),
      collegeName: body.collegeName.trim(),
      branch:      body.branch.trim(),
      yearOfStudy: String(body.yearOfStudy),
      leader:      {
        name:  body.leader.name.trim(),
        email: body.leader.email.trim().toLowerCase(),
        phone: body.leader.phone.trim(),
      },
      members: members.map((m) => ({
        name:  m.name.trim(),
        email: m.email.trim().toLowerCase(),
        phone: m.phone.trim(),
      })),
      mentorSession: Boolean(body.mentorSession),
      totalAmount,
      paymentStatus: 'pending',   // will move to 'paid' after Razorpay webhook
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // ── 5. Respond ──────────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      id: registration._id.toString(),
      message: 'Registration saved! Proceed to payment.',
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
