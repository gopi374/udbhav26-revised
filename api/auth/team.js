/**
 * api/auth/team.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/auth/team
 * Authenticates a team using their unique code from the teams collection.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from '../lib/mongodb.js';
import { Registration } from '../models/Registration.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { teamCode } = req.body;

  if (!teamCode) {
    return res.status(400).json({ success: false, error: 'Team ID is required.' });
  }

  const formattedCode = teamCode.trim().toUpperCase();

  try {
    await connectDB();

    const team = await Registration.findOne({ teamCode: formattedCode }).lean();

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Invalid Team ID. Please check your credentials.'
      });
    }

    // Restriction: All registered teams can access the command center now
    // Payment status check removed as requested

    // Success - Return team metadata
    return res.status(200).json({
      success: true,
      team: {
        id: team.teamCode,
        name: team.teamName,
        college: team.collegeName,
        leader: team.leader?.name || '',
        memberCount: 1 + (team.members?.length || 0),
        psSelectionId: null
      }
    });

  } catch (err) {
    console.error('[/api/auth/team] Auth error:', err);
    return res.status(500).json({
      success: false,
      error: 'Mission control synchronization failure. Please try again.'
    });
  }
}
