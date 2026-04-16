/**
 * api/cashfree-webhook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/cashfree-webhook
 *
 * Safety-net: Cashfree calls this when a payment succeeds even if the
 * user's browser closed before the JS SDK resolved.
 * Finds the Team document by cashfreeOrderId and marks it as paid.
 *
 * Events handled: PAYMENT_SUCCESS, ORDER_PAID
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto  from 'crypto';
import { connectDB }          from './lib/mongodb.js';
import { Team }               from './models/Team.js';
import { sendTeamCodeEmail }  from './lib/email.js';

const WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET;
const APP_ID         = process.env.CASHFREE_APP_ID;
const SECRET_KEY     = process.env.CASHFREE_SECRET_KEY;
const CF_ENV         = process.env.CASHFREE_ENV
  || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const CF_BASE        = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

/** Verify Cashfree HMAC-SHA256 webhook signature */
function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Raw body ─────────────────────────────────────────────────────────────
  let rawBody = '';
  if (typeof req.body === 'string')         rawBody = req.body;
  else if (Buffer.isBuffer(req.body))       rawBody = req.body.toString('utf8');
  else                                       rawBody = JSON.stringify(req.body || {});

  // ── Signature verification ────────────────────────────────────────────────
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (WEBHOOK_SECRET && signature && timestamp) {
    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.warn('[cashfree-webhook] ❌ Signature mismatch — rejected');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } else if (WEBHOOK_SECRET && !signature) {
    console.warn('[cashfree-webhook] ⚠️ No signature header — rejected');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  // ── Parse event ───────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventType = event?.type || event?.event;
  const data      = event?.data || {};
  const order     = data.order   || {};
  const payment   = data.payment || {};

  console.log(`[cashfree-webhook] Event: ${eventType} | Order: ${order.order_id} | Status: ${payment.payment_status}`);

  // Only process successful payments
  if (
    eventType !== 'PAYMENT_SUCCESS' &&
    eventType !== 'ORDER_PAID' &&
    payment.payment_status !== 'SUCCESS'
  ) {
    console.log(`[cashfree-webhook] Ignoring event: ${eventType}`);
    return res.status(200).json({ received: true });
  }

  const orderId       = order.order_id;
  const cfPaymentId   = String(payment.cf_payment_id || '');

  if (!orderId) {
    console.error('[cashfree-webhook] No order_id in payload');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  try {
    await connectDB();

    // Find the team by cashfreeOrderId (set during create-order)
    const team = await Team.findOne({ cashfreeOrderId: orderId });

    if (!team) {
      console.warn(`[cashfree-webhook] No team found for order ${orderId} — possible stale order`);
      // Return 200 so Cashfree doesn't retry indefinitely
      return res.status(200).json({ received: true, message: 'Team not found for order' });
    }

    // Idempotency — already paid
    if (team.paymentStatus === 'paid') {
      console.log(`[cashfree-webhook] Already paid: ${team.code} — skipping`);
      return res.status(200).json({ received: true, message: 'Already processed' });
    }

    // ── Mark paid ───────────────────────────────────────────────────────────
    team.paymentStatus     = 'paid';
    team.cashfreePaymentId = cfPaymentId || null;
    team.paymentDate       = new Date();
    await team.save();

    console.log(`[cashfree-webhook] ✅ Payment confirmed via webhook: ${team.code} | ${team.teamName} | ₹${team.totalAmount}`);

    // ── Send confirmation email ─────────────────────────────────────────────
    if (team.leader?.email) {
      sendTeamCodeEmail({
        to:          team.leader.email,
        teamName:    team.teamName,
        teamCode:    team.code,
        wantsMentor: team.mentorSession,
        amountPaid:  team.totalAmount,
      }).catch(err => console.error('[cashfree-webhook] Email error:', err));
    }

    return res.status(200).json({ received: true, teamCode: team.code });

  } catch (err) {
    console.error('[cashfree-webhook] Error:', err);
    // 500 causes Cashfree to retry
    return res.status(500).json({ error: 'Internal server error — will retry' });
  }
}
