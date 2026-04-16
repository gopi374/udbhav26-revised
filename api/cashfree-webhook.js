/**
 * api/cashfree-webhook.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * POST /api/cashfree-webhook
 *
 * Receives Cashfree payment event webhooks and saves the registration
 * when a PAYMENT_SUCCESS event arrives â€” this is the safety net for
 * cases where the user closed the browser before the JS SDK resolved.
 *
 * Cashfree sends these events:
 *   PAYMENT_SUCCESS  â† we handle this
 *   PAYMENT_FAILED   â† logged only
 *   PAYMENT_PENDING  â† ignored
 *   ORDER_PAID       â† same as PAYMENT_SUCCESS, handled
 *
 * Signature verification:
 *   Cashfree signs each webhook with HMAC-SHA256 using your
 *   CASHFREE_WEBHOOK_SECRET. We verify before processing.
 *
 * Setup in dashboard:
 *   https://merchant.cashfree.com â†’ Developers â†’ Webhooks
 *   URL: https://yourdomain.com/api/cashfree-webhook
 *   Version: 2023-08-01
 *   Events: PAYMENT_SUCCESS, PAYMENT_FAILED, ORDER_PAID
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

import crypto from 'crypto';
import { connectDB }         from './lib/mongodb.js';
import { Registration }      from './models/Registration.js';
import { generateTeamCode }  from './lib/teamCode.js';
import { sendTeamCodeEmail } from './lib/email.js';

const WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET;
const APP_ID         = process.env.CASHFREE_APP_ID;
const SECRET_KEY     = process.env.CASHFREE_SECRET_KEY;
const CF_ENV         = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
const CF_BASE        = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

const BASE_AMOUNT  = 800;
const MENTOR_ADDON = 300;

/**
 * Verify Cashfree webhook signature.
 * Cashfree sends: x-webhook-signature  (base64 HMAC-SHA256)
 *                 x-webhook-timestamp  (Unix seconds)
 * Message to sign: timestamp + rawBody
 */
function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!WEBHOOK_SECRET) return false;
  const message  = `${timestamp}${rawBody}`;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(message)
    .digest('base64');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

export default async function handler(req, res) {
  // Cashfree only POSTs webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // â”€â”€ Collect raw body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rawBody = '';
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf8');
  } else {
    rawBody = JSON.stringify(req.body || {});
  }

  // â”€â”€ Verify signature â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (WEBHOOK_SECRET && signature && timestamp) {
    const valid = verifyWebhookSignature(rawBody, signature, timestamp);
    if (!valid) {
      console.warn('[cashfree-webhook] âŒ Signature mismatch â€” rejected');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } else if (WEBHOOK_SECRET && !signature) {
    console.warn('[cashfree-webhook] âš  No signature header â€” rejected (WEBHOOK_SECRET is set)');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  // â”€â”€ Parse Event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let event;
  try {
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : req.body;
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventType = event?.type || event?.event; // 'PAYMENT_SUCCESS' etc.
  const data      = event?.data || {};
  const order     = data.order     || {};
  const payment   = data.payment   || {};

  console.log(`[cashfree-webhook] Event: ${eventType} | Order: ${order.order_id} | Status: ${payment.payment_status}`);

  // â”€â”€ Only process successful payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (
    eventType !== 'PAYMENT_SUCCESS' &&
    eventType !== 'ORDER_PAID' &&
    payment.payment_status !== 'SUCCESS'
  ) {
    // Acknowledge non-success events (Cashfree retries until 200)
    console.log(`[cashfree-webhook] Ignoring event type: ${eventType}`);
    return res.status(200).json({ received: true });
  }

  const orderId   = order.order_id;
  const cfPaymentId = String(payment.cf_payment_id || '');

  if (!orderId) {
    console.error('[cashfree-webhook] No order_id in event payload');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  try {
    await connectDB();

    // â”€â”€ Idempotency guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existing = await Registration.findOne({ cashfreeOrderId: orderId });
    if (existing) {
      console.log(`[cashfree-webhook] Already registered for order ${orderId} â€” skipping`);
      return res.status(200).json({ received: true, message: 'Already processed' });
    }

    // â”€â”€ Fetch full order from Cashfree to get customer/amount data â”€
    const cfRes = await fetch(`${CF_BASE}/orders/${orderId}`, {
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     APP_ID,
        'x-client-secret': SECRET_KEY,
      },
    });
    const cfOrder = await cfRes.json();

    if (!cfRes.ok || cfOrder.order_status !== 'PAID') {
      console.warn(`[cashfree-webhook] Order ${orderId} not PAID â€” status: ${cfOrder.order_status}`);
      return res.status(200).json({ received: true, message: 'Order not paid yet' });
    }

    // â”€â”€ Extract customer details from order notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // We encode formData into order_note as JSON during create-order
    // Fallback: use customer_details from Cashfree order
    const customer = cfOrder.customer_details || {};
    const note     = cfOrder.order_note || '';

    // Minimal registration from what Cashfree gives us in webhook
    // (Full formData is only available when JS SDK resolves; use webhook as fallback)
    const leaderEmail = customer.customer_email || '';
    const leaderName  = customer.customer_name  || '';
    const leaderPhone = customer.customer_phone || '';
    const cfAmount    = cfOrder.order_amount;
    const mentorSession = cfAmount >= BASE_AMOUNT + MENTOR_ADDON;

    // Try to extract team name from order note
    const teamNameMatch = note.match(/Registration\s*[â€”-]+\s*(.+?)(?:\s*\+|$)/);
    const teamName      = teamNameMatch ? teamNameMatch[1].trim() : `Team_${orderId.slice(-6)}`;

    // â”€â”€ Generate team code + save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const teamCode = await generateTeamCode();

    await Registration.create({
      teamName,
      collegeName:  'Via Webhook',   // full data only in JS-flow; webhook is safety net
      branch:       'Unknown',
      yearOfStudy:  'Unknown',
      leader: { name: leaderName, email: leaderEmail, phone: leaderPhone },
      members:      [],
      mentorSession,
      totalAmount:  cfAmount,
      paymentStatus: 'paid',
      registrationCompleted: true,
      cashfreeOrderId:   orderId,
      cashfreePaymentId: cfPaymentId,
      teamCode,
    });

    console.log(`[cashfree-webhook] âœ… Saved via webhook: ${orderId} | Code: ${teamCode}`);

    // â”€â”€ Send email if we have a valid address â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (leaderEmail && leaderEmail.includes('@')) {
      sendTeamCodeEmail({
        to:          leaderEmail,
        teamName,
        teamCode,
        wantsMentor: mentorSession,
        amountPaid:  cfAmount,
      }).catch(err => console.error('[cashfree-webhook] Email error:', err));
    }

    return res.status(200).json({ received: true, teamCode });

  } catch (err) {
    console.error('[cashfree-webhook] Error:', err);
    if (err.code === 11000) {
      // Duplicate key â€” already registered (race condition with JS flow)
      return res.status(200).json({ received: true, message: 'Already registered' });
    }
    // Return 500 â†’ Cashfree will retry the webhook (up to 5 times)
    return res.status(500).json({ error: 'Internal server error â€” will retry' });
  }
}

