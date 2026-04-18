/**
 * api/verify-payment.js
 * ─────────────────────────────────────────────────────────────────
 * POST /api/verify-payment
 *
 * Called by the frontend after Cashfree redirects back.
 * Verifies the payment server-side, then updates the Team document.
 *
 * Request body: { orderId: string }
 * ─────────────────────────────────────────────────────────────────
 */

import { connectDB }           from './lib/mongodb.js';
import { Team }                from './models/Team.js';
import { sendTeamCodeEmail }   from './lib/email.js';

const APP_ID     = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CF_ENV     = process.env.CASHFREE_ENV
  || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const CF_BASE    = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { orderId } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required.' });
  }

  try {
    // ── 1. Verify with Cashfree server-to-server ──────────────────
    const cfRes = await fetch(`${CF_BASE}/orders/${orderId}`, {
      method:  'GET',
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     APP_ID,
        'x-client-secret': SECRET_KEY,
      },
    });

    const cfData = await cfRes.json();
    console.log(`[verify-payment] Cashfree status for ${orderId}:`, cfData?.order_status);

    if (!cfRes.ok) {
      return res.status(502).json({ success: false, error: 'Could not verify payment with Cashfree.' });
    }

    if (cfData.order_status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error:   `Payment not completed. Status: ${cfData.order_status}`,
        status:  cfData.order_status,
      });
    }

    // ── 2. Get Cashfree payment ID ────────────────────────────────
    let cashfreePaymentId = null;
    try {
      const paymentsRes  = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     APP_ID,
          'x-client-secret': SECRET_KEY,
        },
      });
      const paymentsData = await paymentsRes.json();
      const paid = Array.isArray(paymentsData)
        ? paymentsData.find(p => p.payment_status === 'SUCCESS')
        : null;
      cashfreePaymentId = paid?.cf_payment_id?.toString() || null;
    } catch (_) { /* non-fatal */ }

    // ── 3. Update the Team document ───────────────────────────────
    await connectDB();

    const team = await Team.findOne({ cashfreeOrderId: orderId });
    if (!team) {
      console.error(`[verify-payment] No team found for orderId: ${orderId}`);
      return res.status(404).json({ success: false, error: 'Team not found for this order.' });
    }

    // Idempotent: already marked paid
    if (team.paymentStatus === 'paid') {
      console.log(`[verify-payment] Already paid: ${team.code}`);
      return res.status(200).json({
        success:     true,
        status:      'PAID',
        teamCode:    team.code,
        teamName:    team.teamName,
        leaderEmail: team.leader.email,
        amount:      team.totalAmount,
        wantsMentor: team.mentorSession,
        orderId,
      });
    }

    team.paymentStatus      = 'paid';
    team.cashfreePaymentId  = cashfreePaymentId;
    team.paymentDate        = new Date();
    await team.save();

    console.log(`[verify-payment] ✅ Payment confirmed: ${team.code} | ${team.teamName} | ₹${team.totalAmount}`);

    // ── 4. Send confirmation email ────────────────────────────────
    sendTeamCodeEmail({
      to:          team.leader.email,
      teamName:    team.teamName,
      teamCode:    team.code,
      wantsMentor: team.mentorSession,
      amountPaid:  team.totalAmount,
    }).catch(err => console.error('[verify-payment] Email error:', err));

    return res.status(200).json({
      success:     true,
      status:      'PAID',
      teamCode:    team.code,
      teamName:    team.teamName,
      leaderEmail: team.leader.email,
      amount:      team.totalAmount,
      wantsMentor: team.mentorSession,
      orderId,
    });

  } catch (err) {
    console.error('[verify-payment] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Payment verification failed.' });
  }
}
