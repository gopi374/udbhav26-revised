/**
 * api/verify-payment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/verify-payment
 *
 * 1. Verifies Razorpay signature (HMAC-SHA256)
 * 2. Saves the full registration to MongoDB with paymentStatus: 'paid'
 * 3. Generates a unique team code (UDB-XXXX)
 * 4. Sends confirmation email with team code (async, non-blocking to client)
 *
 * Request body (JSON):
 *   {
 *     razorpay_order_id, razorpay_payment_id, razorpay_signature,
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
 *   200 { success: true, teamCode, teamName, amountPaid, wantsMentor }
 *   400 { success: false, error }
 *   500 { success: false, error }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import { connectDB }         from './lib/mongodb.js';
import { Registration }      from './models/Registration.js';
import { generateTeamCode }  from './lib/teamCode.js';
import { sendTeamCodeEmail } from './lib/email.js';

const KEY_SECRET   = process.env.RAZORPAY_KEY_SECRET;
const BASE_AMOUNT  = 800;
const MENTOR_ADDON = 300;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

function validateMember(m, label) {
  if (!m || typeof m !== 'object') return `${label}: missing data`;
  if (!(m.name  || '').trim()) return `${label}: name is required`;
  if (!isValidEmail(m.email))  return `${label}: valid email required`;
  if (!(m.phone || '').trim()) return `${label}: phone is required`;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, formData } = req.body || {};

    // ── 1. Presence checks ──────────────────────────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment verification data.' });
    }
    if (!formData) {
      return res.status(400).json({ success: false, error: 'Missing registration data.' });
    }
    if (!KEY_SECRET) {
      return res.status(500).json({ success: false, error: 'Server configuration error.' });
    }

    // ── 2. Verify Razorpay HMAC-SHA256 signature ────────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      console.warn('[verify-payment] Signature mismatch — possible tampered request', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({ success: false, error: 'Payment verification failed. Please contact support.' });
    }

    // ── 3. Validate form data ───────────────────────────────────────────────
    if (!(formData.teamName    || '').trim()) return res.status(400).json({ success: false, error: 'Team name is required.' });
    if (!(formData.collegeName || '').trim()) return res.status(400).json({ success: false, error: 'College name is required.' });
    if (!(formData.branch      || '').trim()) return res.status(400).json({ success: false, error: 'Branch is required.' });
    if (!(formData.yearOfStudy || '').trim()) return res.status(400).json({ success: false, error: 'Year of study is required.' });

    const leaderErr = validateMember(formData.leader, 'Leader');
    if (leaderErr) return res.status(400).json({ success: false, error: leaderErr });

    const members = Array.isArray(formData.members) ? formData.members : [];
    for (let i = 0; i < members.length; i++) {
      const err = validateMember(members[i], `Member ${i + 2}`);
      if (err) return res.status(400).json({ success: false, error: err });
    }

    // Server-authoritative amount
    const totalAmount = formData.mentorSession ? BASE_AMOUNT + MENTOR_ADDON : BASE_AMOUNT;

    // ── 4. Connect & duplicate-payment guard ────────────────────────────────
    await connectDB();

    const existing = await Registration.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) {
      // Idempotent — same payment ID seen before, return what was saved
      return res.status(200).json({
        success:     true,
        teamCode:    existing.teamCode,
        teamName:    existing.teamName,
        amountPaid:  existing.totalAmount,
        wantsMentor: existing.mentorSession,
        message:     'Already registered.',
      });
    }

    // ── 5. Generate unique team code ────────────────────────────────────────
    const teamCode = await generateTeamCode();

    // ── 6. Save registration ────────────────────────────────────────────────
    const registration = await Registration.create({
      teamName:    formData.teamName.trim(),
      collegeName: formData.collegeName.trim(),
      branch:      formData.branch.trim(),
      yearOfStudy: String(formData.yearOfStudy),
      leader: {
        name:  formData.leader.name.trim(),
        email: formData.leader.email.trim().toLowerCase(),
        phone: formData.leader.phone.trim(),
      },
      members: members.map(m => ({
        name:  m.name.trim(),
        email: m.email.trim().toLowerCase(),
        phone: m.phone.trim(),
      })),
      mentorSession:     Boolean(formData.mentorSession),
      totalAmount,
      paymentStatus:     'paid',
      registrationCompleted: true,
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      teamCode,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });

    console.log(`[verify-payment] ✅ Registered: ${registration._id} | Team: ${formData.teamName} | Code: ${teamCode}`);

    // ── 7. Send email (async — do NOT await so client gets response fast) ───
    sendTeamCodeEmail({
      to:          formData.leader.email.trim().toLowerCase(),
      teamName:    formData.teamName.trim(),
      teamCode,
      wantsMentor: Boolean(formData.mentorSession),
      amountPaid:  totalAmount,
    }).catch(err => console.error('[verify-payment] Email dispatch error:', err));

    // ── 8. Respond immediately ──────────────────────────────────────────────
    return res.status(200).json({
      success:     true,
      teamCode,
      teamName:    formData.teamName.trim(),
      amountPaid:  totalAmount,
      wantsMentor: Boolean(formData.mentorSession),
      leaderEmail: formData.leader.email.trim().toLowerCase(),
      message:     'Registration confirmed!',
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'This team is already registered.' });
    }

    return res.status(500).json({
      success: false,
      error: 'Server error — please contact support with your payment ID.',
    });
  }
}
