/**
 * api/verify-payment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — POST /api/verify-payment
 *
 * 1. Verifies Razorpay payment signature (HMAC-SHA256)
 * 2. Saves the full registration to MongoDB with paymentStatus: 'paid'
 *
 * Request body (JSON):
 *   {
 *     razorpay_order_id,
 *     razorpay_payment_id,
 *     razorpay_signature,
 *     formData: {
 *       teamName, collegeName, branch, yearOfStudy,
 *       leader: { name, email, phone },
 *       members: [{ name, email, phone }, ...],
 *       mentorSession: boolean,
 *       totalAmount: number
 *     }
 *   }
 *
 * Response:
 *   200 { success: true, id: "<mongo _id>" }
 *   400 { success: false, error: "Payment verification failed." }
 *   500 { success: false, error: "Server error" }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import { connectDB }    from './lib/mongodb.js';
import { Registration } from './models/Registration.js';
import { Team }         from './models/Team.js';

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// ── Simple helpers ──────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

function validateMember(m, label) {
  if (!m || typeof m !== 'object') return `${label}: missing data`;
  if (!(m.name  || '').trim()) return `${label}: name is required`;
  if (!isValidEmail(m.email))  return `${label}: valid email required`;
  if (!(m.phone || '').trim()) return `${label}: phone is required`;
  return null;
}

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, teamCode } = req.body || {};

    // ── 1. Verify Razorpay signature ────────────────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment verification data.' });
    }
    if (!teamCode) {
      return res.status(400).json({ success: false, error: 'Team code is required.' });
    }
    if (!KEY_SECRET) {
      return res.status(500).json({ success: false, error: 'Server configuration error.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[/api/verify-payment] Signature mismatch — possible tampered request');
      return res.status(400).json({ success: false, error: 'Payment verification failed. Please contact support.' });
    }

    // ── 2. Connect to MongoDB ───────────────────────────────────────────────
    await connectDB();

    // ── 3. Look up the team by code ────────────────────────────────────────
    const team = await Team.findOne({ code: teamCode.trim().toUpperCase() });
    if (!team) {
      return res.status(404).json({ success: false, error: 'Invalid team code.' });
    }
    if (team.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        id: team.registrationId || team._id.toString(),
        message: 'Already registered.',
      });
    }

    // ── 4. Check for duplicate payment ID ──────────────────────────────────
    const existing = await Registration.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) {
      return res.status(200).json({
        success: true,
        id: existing._id.toString(),
        message: 'Already registered.',
      });
    }

    // ── 5. Save registration with paymentStatus: 'paid' ────────────────────
    const registration = await Registration.create({
      teamName:    team.teamName,
      collegeName: team.collegeName,
      branch:      team.branch,
      yearOfStudy: '',  // not stored in Team model
      leader: {
        name:  team.leader.name,
        email: team.leader.email,
        phone: team.leader.phone,
      },
      members:           [],  // optional — not stored in Team model
      mentorSession:     team.mentorSession,
      totalAmount:       team.totalAmount,
      paymentStatus:     'paid',
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // ── 6. Mark team as paid ────────────────────────────────────────────────
    await Team.findByIdAndUpdate(team._id, {
      paymentStatus: 'paid',
      registrationId: registration._id.toString(),
    });

    console.log(`[/api/verify-payment] ✅ Registration saved: ${registration._id} | Team: ${team.teamName} | Code: ${team.code}`);

    return res.status(200).json({
      success: true,
      id: registration._id.toString(),
      message: 'Registration confirmed!',
    });

  } catch (err) {
    console.error('[/api/verify-payment] Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'This team is already registered.' });
    }

    return res.status(500).json({
      success: false,
      error: 'Server error — please contact support with your payment ID.',
    });
  }
}
