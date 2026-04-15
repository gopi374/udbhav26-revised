/**
 * api/create-order.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — POST /api/create-order
 *
 * Creates a Razorpay Order server-side (amount is set here, never trusted
 * from the client). Returns the order_id + publishable key to the frontend.
 *
 * Request body (JSON):
 *   { mentorSession: boolean }
 *
 * Response:
 *   200 { success: true, orderId, amount, currency, key }
 *   400 / 500 { success: false, error }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Razorpay from 'razorpay';
import { connectDB } from './lib/mongodb.js';
import { Team }      from './models/Team.js';

const KEY_ID     = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!KEY_ID || !KEY_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.',
    });
  }

  try {
    const { teamCode } = req.body || {};

    if (!teamCode) {
      return res.status(400).json({ success: false, error: 'Team code is required.' });
    }

    // Look up the team — amount is authoritative from DB, never from client
    await connectDB();
    const team = await Team.findOne({ code: teamCode.trim().toUpperCase() });

    if (!team) {
      return res.status(404).json({ success: false, error: 'Invalid team code.' });
    }
    if (team.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: 'This team has already paid.' });
    }

    const amountPaisa = team.totalAmount * 100;  // convert ₹ to paise

    const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

    const order = await razorpay.orders.create({
      amount:   amountPaisa,
      currency: 'INR',
      receipt:  `udbhav26_${team.code}_${Date.now()}`,
      notes: {
        event:     "UDBHAV'26 Round 2",
        teamCode:  team.code,
        teamName:  team.teamName,
        mentorSession: team.mentorSession ? 'yes' : 'no',
      },
    });

    return res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      KEY_ID,
      // Return team info so frontend can prefill Razorpay
      team: {
        name:  team.teamName,
        leader: {
          name:  team.leader.name,
          email: team.leader.email,
          phone: team.leader.phone,
        },
        mentorSession: team.mentorSession,
      },
    });

  } catch (err) {
    console.error('[/api/create-order] Razorpay error:', err);
    return res.status(500).json({
      success: false,
      error: 'Could not create payment order. Please try again.',
    });
  }
}
