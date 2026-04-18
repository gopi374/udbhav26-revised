/**
 * api/team.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Serverless Function — GET /api/team?code=UDB26-001
 *
 * Looks up a shortlisted team by their unique team code.
 * Returns safe public fields only (no internal IDs or sensitive data).
 *
 * Response 200:
 *   {
 *     success: true,
 *     team: {
 *       code, teamName, collegeName, branch,
 *       memberCount, mentorSession, totalAmount, paymentStatus
 *     }
 *   }
 * Response 404: team not found
 * Response 400: already paid
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

  const code = (req.query.code || '').trim().toUpperCase();

  if (!code) {
    return res.status(400).json({ success: false, error: 'Team code is required.' });
  }

  try {
    await connectDB();

    const team = await Team.findOne({ code }).lean();

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Invalid team code. Please check your shortlisting email and try again.',
      });
    }

    if (team.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'This team has already completed payment. Contact support if this is an error.',
        alreadyPaid: true,
      });
    }

    if (!team.codeGenerated) {
      return res.status(404).json({
        success: false,
        error: 'Team codes have not been generated yet. Please check back later.',
      });
    }

    // Return public fields for autofill on registration page
    return res.status(200).json({
      success: true,
      team: {
        _id:           team._id,
        code:          team.code,
        teamName:      team.teamName,
        collegeName:   team.collegeName,
        branch:        team.branch,
        memberCount:   team.memberCount,
        mentorSession: team.mentorSession,
        totalAmount:   team.totalAmount,
        paymentStatus: team.paymentStatus,
        leader: {
          name:  team.leader.name,
          email: team.leader.email,
          phone: team.leader.phone,
        },
      },
    });

  } catch (err) {
    console.error('[/api/team] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error. Please try again.',
    });
  }
}
