/**
 * api/mentorship/opt.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/mentorship/opt
 * Allows a team to opt-in for a mentor session.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }    from '../lib/mongodb.js';
import { Team }         from '../models/Team.js';
import { Registration } from '../models/Registration.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { teamCode, receiptUrl } = req.body;

  if (!teamCode) {
    return res.status(400).json({ success: false, error: 'Team ID is required.' });
  }

  if (!receiptUrl) {
    return res.status(400).json({ success: false, error: 'Payment receipt is required.' });
  }

  const formattedCode = teamCode.trim().toUpperCase();

  try {
    await connectDB();

    // Update both Team and Registration collections
    const [teamUpdate, regUpdate] = await Promise.all([
      Team.findOneAndUpdate(
        { code: formattedCode },
        { $set: { mentorshipStatus: 'pending', mentorshipReceiptUrl: receiptUrl, mentorSession: true, mentorshipSubmittedAt: new Date() } },
        { new: true }
      ),
      Registration.findOneAndUpdate(
        { teamCode: formattedCode },
        { $set: { mentorshipStatus: 'pending', mentorshipReceiptUrl: receiptUrl, mentorSession: true, mentorshipSubmittedAt: new Date() } },
        { new: true }
      )
    ]);

    if (!teamUpdate && !regUpdate) {
      return res.status(404).json({
        success: false,
        error: 'Team not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully opted-in for mentorship.'
    });

  } catch (err) {
    console.error('[/api/mentorship/opt] error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update mentorship status. Please try again.'
    });
  }
}
