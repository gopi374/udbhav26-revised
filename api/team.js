/**
 * api/team.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/team?code=UDB-XXXX
 *
 * Looks up a shortlisted team by their unique team code.
 * Priority:
 *   1. Check `teams` collection (pre-imported shortlisted teams)
 *   2. Fall back to `registrations` collection (already-submitted teams)
 *
 * This handles the case where teams were registered without being first
 * imported into the `teams` collection.
 *
 * Response 200:
 *   { success: true, team: { code, teamName, collegeName, branch, ... } }
 * Response 400: already paid / already registered
 * Response 404: team not found in either collection
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }    from './lib/mongodb.js';
import { Team }         from './models/Team.js';
import { Registration } from './models/Registration.js';
import { sanitizeCode } from './lib/sanitize.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const code = sanitizeCode(req.query.code);

  if (!code) {
    return res.status(400).json({ success: false, error: 'Team code is required.' });
  }

  try {
    await connectDB();

    // ── 1. Check `teams` collection first (pre-imported shortlisted teams) ───
    const team = await Team.findOne({ code }).lean();

    if (team) {
      if (team.paymentStatus === 'paid') {
         return res.status(400).json({
           success: false,
           error: 'You have already paid the amount.',
           alreadyPaid: true,
         });
       }

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
            name:  team.leader?.name  || '',
            email: team.leader?.email || '',
            phone: team.leader?.phone || '',
          },
          members: team.members || [],
        },
      });
    }

    // ── 2. Fall back to `registrations` collection ───────────────────────────
    // This covers teams that submitted before being imported into `teams`.
    const reg = await Registration.findOne({ teamCode: code }).lean();

    if (reg) {
      if (reg.paymentStatus === 'paid' || reg.registrationCompleted) {
        return res.status(400).json({
           success: false,
           error: 'You have already paid the amount.',
           alreadyPaid: reg.paymentStatus === 'paid',
        });
      }

      // If pending and not fully registered, allow them to continue
      return res.status(200).json({
        success: true,
        team: {
          _id:           reg._id,
          code:          reg.teamCode,
          teamName:      reg.teamName,
          collegeName:   reg.collegeName,
          branch:        reg.branch,
          memberCount:   reg.members ? reg.members.length + 1 : 1,
          mentorSession: reg.mentorSession,
          totalAmount:   reg.totalAmount,
          paymentStatus: reg.paymentStatus,
          leader: {
            name:  reg.leader?.name  || '',
            email: reg.leader?.email || '',
            phone: reg.leader?.phone || '',
          },
          members: reg.members || [],
        },
      });
    }

    // ── 3. Not found in either collection ────────────────────────────────────
    console.log(`[/api/team] Code not found in teams or registrations: ${code}`);
    return res.status(404).json({
      success: false,
      error: `'${code}' doesn't match any shortlisted team. Double-check your email or contact support.`,
    });

  } catch (err) {
    console.error('[/api/team] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message === 'No network connection' ? 'No network connection' : 'Server error. Please try again.',
    });
  }
}
