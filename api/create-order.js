/**
 * api/create-order.js
 * ─────────────────────────────────────────────────────────────────
 * POST /api/create-order
 *
 * Validates a team code, creates a Cashfree Payment Order,
 * and returns the payment_session_id for the frontend SDK.
 *
 * Request body:
 *   { teamCode: string, mentorSession: boolean, members: [{name,phone}] }
 *
 * Response:
 *   200 { success: true, orderId, paymentSessionId, amount, cfEnv }
 *   400/404/500 { success: false, error }
 * ─────────────────────────────────────────────────────────────────
 */

import { connectDB } from './lib/mongodb.js';
import { Team }      from './models/Team.js';

const APP_ID     = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CF_ENV     = process.env.CASHFREE_ENV
  || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const CF_BASE    = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

console.log(`[create-order] Using Cashfree ${CF_ENV.toUpperCase()} (${CF_BASE})`);

const BASE_AMOUNT  = 800;
const MENTOR_ADDON = 300;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!APP_ID || !SECRET_KEY) {
    console.error('[create-order] Cashfree credentials missing');
    return res.status(500).json({ success: false, error: 'Payment gateway not configured.' });
  }

  try {
    const { teamCode, mentorSession, members } = req.body || {};

    if (!teamCode) {
      return res.status(400).json({ success: false, error: 'Team code is required.' });
    }

    // ── Look up team ──────────────────────────────────────────────
    await connectDB();
    const team = await Team.findOne({ code: teamCode.trim().toUpperCase() });

    if (!team) {
      return res.status(404).json({ success: false, error: 'Invalid team code. Please check and try again.' });
    }
    if (!team.codeGenerated) {
      return res.status(400).json({ success: false, error: 'Team codes have not been released yet.' });
    }
    if (team.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: 'This team has already completed payment.' });
    }

    // ── Amount ────────────────────────────────────────────────────
    const wantsMentor = mentorSession === true;
    const amount      = wantsMentor ? BASE_AMOUNT + MENTOR_ADDON : BASE_AMOUNT;
    const orderId     = `UDBHAV26_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // ── Return URL ────────────────────────────────────────────────
    // In production (CASHFREE_ENV=production) always use APP_URL so
    // Cashfree gets an https:// URL. In sandbox use the request host.
    let returnBase;
    if (CF_ENV === 'production' && process.env.APP_URL) {
      returnBase = process.env.APP_URL.replace(/\/$/, ''); // e.g. https://udbhav26.in
    } else {
      const rawHost  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
      const host     = rawHost.replace(':8080', ':5173');
      const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      returnBase = `${protocol}://${host}`;
    }
    const returnUrl = `${returnBase}/payment-status?order_id={order_id}&status={order_status}`;
    const notifyUrl = `${returnBase}/api/cashfree-webhook`;

    const payload = {
      order_id:      orderId,
      order_amount:  amount,
      order_currency: 'INR',
      customer_details: {
        customer_id:    `cust_${team._id}`,
        customer_name:  team.leader.name,
        customer_email: team.leader.email,
        customer_phone: team.leader.phone,
      },
      order_meta: {
        return_url:      returnUrl,
        notify_url:      notifyUrl,
        payment_methods: 'cc,dc,upi,nb,app,paylater,emi',
      },
      order_note: `UDBHAV'26 — ${team.teamName}${wantsMentor ? ' + Mentor Session' : ''}`,
    };

    const cfRes = await fetch(`${CF_BASE}/orders`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     APP_ID,
        'x-client-secret': SECRET_KEY,
      },
      body: JSON.stringify(payload),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.payment_session_id) {
      console.error('[create-order] Cashfree error:', JSON.stringify(cfData, null, 2));
      return res.status(500).json({
        success: false,
        error:   cfData?.message || cfData?.error || 'Could not create payment order.',
        cfError: process.env.NODE_ENV !== 'production' ? cfData : undefined,
      });
    }

    // Store orderId + pending members on the team doc
    team.cashfreeOrderId = orderId;
    if (Array.isArray(members) && members.length) {
      team.members = members.map(m => ({ name: m.name, phone: m.phone }));
    }
    team.mentorSession = wantsMentor;
    team.totalAmount   = amount;
    await team.save();

    console.log(`[create-order] ✅ Order ${orderId} | Team: ${team.teamName} | ₹${amount}`);

    return res.status(200).json({
      success:          true,
      orderId:          cfData.order_id,
      paymentSessionId: cfData.payment_session_id,
      amount,
      teamCode:         team.code,
      teamName:         team.teamName,
      leaderEmail:      team.leader.email,
      cfEnv:            CF_ENV,
    });

  } catch (err) {
    console.error('[create-order] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Could not create payment order.' });
  }
}
