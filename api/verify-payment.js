/**
 * api/verify-payment.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/verify-payment
 *
 * Verifies a Cashfree payment by calling the Cashfree Orders API
 * (GET /orders/{order_id}) and checking order_status === 'PAID'.
 *
 * No HMAC signature needed â€” server-to-server API call is the
 * authoritative source of truth.
 *
 * Request body (JSON):
 *   {
 *     orderId:   string,   // Cashfree order_id returned from create-order
 *     formData:  { teamName, collegeName, branch, yearOfStudy,
 *                  leader: { name, email, phone },
 *                  members: [...], mentorSession: boolean }
 *   }
 *
 * Response:
 *   200 { success: true, teamCode, teamName, amountPaid, wantsMentor }
 *   400/500 { success: false, error }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

import { connectDB }         from './lib/mongodb.js';
import { Registration }      from './models/Registration.js';
import { generateTeamCode }  from './lib/teamCode.js';
import { sendTeamCodeEmail } from './lib/email.js';

const APP_ID     = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CF_ENV     = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
const CF_BASE    = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

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

  if (!APP_ID || !SECRET_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration error.' });
  }

  try {
    const { orderId, formData } = req.body || {};

    // â”€â”€ 1. Presence checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing Cashfree order ID.' });
    }
    if (!formData) {
      return res.status(400).json({ success: false, error: 'Missing registration data.' });
    }

    // â”€â”€ 2. Fetch order status from Cashfree (authoritative) â”€â”€â”€â”€â”€
    const cfRes = await fetch(`${CF_BASE}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     APP_ID,
        'x-client-secret': SECRET_KEY,
      },
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok) {
      console.error('[verify-payment] Cashfree order fetch error:', cfData);
      return res.status(400).json({ success: false, error: 'Could not retrieve payment status. Please contact support.' });
    }

    // Cashfree statuses: ACTIVE, PAID, EXPIRED, CANCELLED
    const orderStatus = cfData.order_status;
    console.log(`[verify-payment] Order ${orderId} status: ${orderStatus}`);

    if (orderStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: orderStatus === 'ACTIVE'
          ? 'Payment not completed yet. Please complete the payment and try again.'
          : `Payment ${orderStatus.toLowerCase()}. Please contact support.`,
      });
    }

    // â”€â”€ 3. Extract Cashfree payment ID from payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fetch payment details for this order to get cf_payment_id
    let cfPaymentId = cfData.cf_order_id || orderId;
    try {
      const pymtRes  = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     APP_ID,
          'x-client-secret': SECRET_KEY,
        },
      });
      const payments = await pymtRes.json();
      if (Array.isArray(payments) && payments.length > 0) {
        cfPaymentId = String(payments[0].cf_payment_id || cfPaymentId);
      }
    } catch (_) { /* non-fatal */ }

    // â”€â”€ 4. Validate form data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ 5. Connect DB + duplicate guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await connectDB();

    const existing = await Registration.findOne({ cashfreeOrderId: orderId });
    if (existing) {
      return res.status(200).json({
        success:     true,
        teamCode:    existing.teamCode,
        teamName:    existing.teamName,
        amountPaid:  existing.totalAmount,
        wantsMentor: existing.mentorSession,
        message:     'Already registered.',
      });
    }

    // â”€â”€ 6. Generate team code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const teamCode = await generateTeamCode();

    // â”€â”€ 7. Save registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      cashfreeOrderId:   orderId,
      cashfreePaymentId: cfPaymentId,
      teamCode,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });

    console.log(`[verify-payment] âœ… Registered: ${registration._id} | Team: ${formData.teamName} | Code: ${teamCode}`);

    // â”€â”€ 8. Send confirmation email (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sendTeamCodeEmail({
      to:          formData.leader.email.trim().toLowerCase(),
      teamName:    formData.teamName.trim(),
      teamCode,
      wantsMentor: Boolean(formData.mentorSession),
      amountPaid:  totalAmount,
    }).catch(err => console.error('[verify-payment] Email error:', err));

    // â”€â”€ 9. Respond â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      error: 'Server error â€” please contact support with your order ID.',
    });
  }
}

