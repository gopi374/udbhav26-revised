/**
 * api/payment-status.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/payment-status?order_id=UDBHAV26_xxx
 *
 * Polled by payment-status.html after Cashfree redirects back.
 * Returns the current payment state from MongoDB so the page can show
 * success / pending / failed without re-calling Cashfree directly.
 *
 * Response shape:
 *   { success, paymentStatus, teamCode, teamName, leaderEmail,
 *     amount, wantsMentor, orderId, paidAt }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from './lib/mongodb.js';
import { Team }      from './models/Team.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const orderId = req.query?.order_id || req.query?.orderId;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'order_id is required.' });
  }

  try {
    await connectDB();

    const team = await Team.findOne({ cashfreeOrderId: orderId })
      .select('code teamName leader totalAmount mentorSession paymentStatus paymentDate cashfreeOrderId cashfreePaymentId')
      .lean();

    if (!team) {
      // Order exists on Cashfree but team record not found (race-condition window)
      return res.status(404).json({
        success: false,
        paymentStatus: 'pending',
        error: 'Order not found — please wait a moment and try again.',
      });
    }

    return res.status(200).json({
      success:       true,
      paymentStatus: team.paymentStatus,         // "pending" | "paid" | "failed"
      teamCode:      team.code,
      teamName:      team.teamName,
      leaderEmail:   team.leader?.email || '',
      amount:        team.totalAmount,
      wantsMentor:   team.mentorSession || false,
      orderId:       team.cashfreeOrderId,
      cfPaymentId:   team.cashfreePaymentId || null,
      paidAt:        team.paymentDate || null,
    });

  } catch (err) {
    console.error('[payment-status] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
}
