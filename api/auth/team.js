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
    
    const [team, registration] = await Promise.all([
      import('../models/Team.js').then(m => m.Team.findOne({ code: formattedCode }).lean()),
      Registration.findOne({ teamCode: formattedCode }).lean()
    ]);

    const activeTeam = team || registration;

    if (!activeTeam) {
      return res.status(404).json({
        success: false,
        error: 'Invalid Team ID. Please check your credentials.'
      });
    }

    // Restriction: Allow 'paid' and 'pending' teams to enter
    const status = activeTeam.paymentStatus;
    if (status !== 'paid' && status !== 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Access Denied. Registration not found for this status.',
        status: status
      });
    }
    // Restriction: All registered teams can access the command center now
    // Payment status check removed as requested

    // Success - Return team metadata
    return res.status(200).json({
      success: true,
      team: {
        id: activeTeam.code || activeTeam.teamCode,
        name: activeTeam.teamName,
        college: activeTeam.collegeName,
        leader: activeTeam.leader?.name || '',
        memberCount: 1 + (activeTeam.members?.length || 0),
        psSelectionId: activeTeam.psSelectionId || null
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
