/**
 * GET /api/team-dashboard?code=UDB-XXXX
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns team dashboard data for a given team code.
 * Sources:
 *   - Primary:   Team collection (has psSelectionId, psSelectedAt)
 *   - Secondary: Registration collection (richer member data with emails)
 *
 * Response 200:
 *   {
 *     success: true,
 *     team: {
 *       code, teamName, collegeName, branch,
 *       paymentStatus, mentorSession,
 *       leader: { name, email, phone },
 *       members: [{ name, email?, phone }],
 *       ps: { order, title, domain, description, slotsTotal, slotsTaken } | null,
 *       psSelectedAt: ISO string | null
 *     }
 *   }
 */

import { connectDB }       from './lib/mongodb.js';
import { Team }            from './models/Team.js';
import { Registration }    from './models/Registration.js';
import { ProblemStatement } from './models/ProblemStatement.js';

const CODE_RE = /^UDB-[A-Z0-9]{2,8}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const code = (req.query.code || '').trim().toUpperCase();

  if (!code || !CODE_RE.test(code)) {
    return res.status(400).json({ error: 'invalid_format', message: 'Invalid team code format. Expected: UDB-XXXX' });
  }

  try {
    await connectDB();

    // ── Primary: Team record ────────────────────────────────────────────────
    const team = await Team.findOne({ code }).lean();

    if (!team) {
      return res.status(404).json({
        error:   'not_found',
        message: 'Team not found. Please check your team code.',
      });
    }

    // Payment status check removed as requested

    // ── Secondary: Registration record (richer member data) ────────────────
    // Registration uses teamCode field; Team uses code field — same value
    const reg = await Registration.findOne({ teamCode: code }).lean();

    // Prefer Registration members (has email), fall back to Team.members
    let leader  = team.leader;
    let members = team.members || [];

    if (reg) {
      leader  = reg.leader  || leader;
      members = reg.members || members;
    }

    // ── PS Selection ────────────────────────────────────────────────────────
    let ps = null;
    if (team.psSelectionId) {
      const psDoc = await ProblemStatement.findById(team.psSelectionId).lean();
      if (psDoc) {
        ps = {
          order:       psDoc.order,
          title:       psDoc.title,
          domain:      psDoc.domain      || '',
          description: psDoc.description || '',
          slotsTotal:  psDoc.slotsTotal,
          slotsTaken:  psDoc.slotsTaken,
        };
      }
    }

    return res.status(200).json({
      success: true,
      team: {
        code:          team.code,
        teamName:      team.teamName,
        collegeName:   team.collegeName,
        branch:        team.branch,
        paymentStatus: team.paymentStatus,
        mentorSession: team.mentorSession,
        leader,
        members,
        ps,
        psSelectedAt: team.psSelectedAt || null,
      },
    });

  } catch (err) {
    console.error('[/api/team-dashboard] error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Server error. Please try again.' });
  }
}
