/**
 * api/admin/teams-view.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Full teams view for the Admin Teams panel.
 * Aggregates Team + ProblemStatement + Submission in one payload.
 *
 *  GET   /api/admin/teams/view         — all teams with full data (PS + submission)
 *  PATCH /api/admin/teams/:id/payment  — override payment status manually
 *  PATCH /api/admin/teams/:id/member   — edit a member's name/phone
 *  PATCH /api/admin/teams/:id/mentor   — toggle mentor session + update amount
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }        from '../lib/mongodb.js';
import { Team }             from '../models/Team.js';
import { ProblemStatement } from '../models/ProblemStatement.js';
import { Submission }       from '../models/Submission.js';

function authGuard(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// ── GET /api/admin/teams/view ─────────────────────────────────────────────────
export async function teamsViewHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'method_not_allowed' });
  if (!authGuard(req, res)) return;

  try {
    await connectDB();

    const q      = (req.query.q      || '').trim();
    const status = req.query.status  || 'all';
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(200, parseInt(req.query.limit || '50'));

    const filter = {};
    if (status !== 'all') filter.paymentStatus = status;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { teamName:      re },
        { collegeName:   re },
        { code:          re },
        { 'leader.name':  re },
        { 'leader.email': re },
        { 'leader.phone': re },
      ];
    }

    const [teams, total] = await Promise.all([
      Team.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'psSelectionId', model: ProblemStatement, select: 'order title domain' })
        .lean(),
      Team.countDocuments(filter),
    ]);

    // ── Fetch stats ────────────────────────────────────────────────────────────
    const stats = {
      total:   await Team.countDocuments(),
      paid:    await Team.countDocuments({ paymentStatus: 'paid' }),
      pending: await Team.countDocuments({ paymentStatus: 'pending' }),
      psSelected: await Team.countDocuments({ psSelectionId: { $ne: null } }),
    };

    // ── Fetch submissions for all team codes ────────────────────────────────────
    const teamCodes = teams.map(t => t.code).filter(Boolean);
    const submissions = teamCodes.length
      ? await Submission.find({ teamCode: { $in: teamCodes } }).lean()
      : [];
    const subMap = {};
    for (const s of submissions) subMap[s.teamCode] = s;

    // ── Shape response ─────────────────────────────────────────────────────────
    const result = teams.map(t => {
      const sub = subMap[t.code] || null;
      return {
        _id:          t._id,
        code:         t.code || null,
        teamName:     t.teamName,
        collegeName:  t.collegeName,
        branch:       t.branch,
        memberCount:  t.memberCount,
        leader:       t.leader,
        members:      t.members || [],
        mentorSession: t.mentorSession,
        totalAmount:  t.totalAmount,
        paymentStatus: t.paymentStatus,
        paymentDate:   t.paymentDate || null,
        cashfreeOrderId:   t.cashfreeOrderId || null,
        cashfreePaymentId: t.cashfreePaymentId || null,
        ps: t.psSelectionId
          ? {
              id:     t.psSelectionId._id,
              order:  t.psSelectionId.order,
              title:  t.psSelectionId.title,
              domain: t.psSelectionId.domain,
            }
          : null,
        psSelectedAt: t.psSelectedAt || null,
        submission: sub
          ? { pptLink: sub.pptLink || null, liveLink: sub.liveLink || null, submittedAt: sub.submittedAt || null }
          : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      teams: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    });

  } catch (err) {
    console.error('[admin/teams-view] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── PATCH /api/admin/teams/:id/payment ────────────────────────────────────────
export async function teamPaymentOverrideHandler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, error: 'method_not_allowed' });
  if (!authGuard(req, res)) return;

  try {
    await connectDB();
    const { id } = req.params;
    const { paymentStatus } = req.body || {};

    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: 'paymentStatus must be "pending", "paid", or "failed".' });
    }

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    const prev = team.paymentStatus;
    team.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid' && prev !== 'paid') {
      team.paymentDate = new Date();
    }

    await team.save();
    console.log(`[admin/teams] Payment override: ${team.teamName} → ${paymentStatus} (was: ${prev})`);
    return res.status(200).json({ success: true, team: { _id: team._id, paymentStatus: team.paymentStatus, paymentDate: team.paymentDate } });

  } catch (err) {
    console.error('[admin/teams] payment override error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── PATCH /api/admin/teams/:id/member ────────────────────────────────────────
// Body: { index: 0..2, field: 'name'|'phone', value: '...' }
// index -1 means the leader
export async function teamMemberEditHandler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, error: 'method_not_allowed' });
  if (!authGuard(req, res)) return;

  try {
    await connectDB();
    const { id }    = req.params;
    const { index, field, value } = req.body || {};

    if (!['name', 'phone', 'email'].includes(field)) {
      return res.status(400).json({ success: false, error: 'field must be name, phone, or email.' });
    }
    if (typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({ success: false, error: 'value is required.' });
    }

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    if (index === -1 || index === '-1') {
      // Leader
      if (!team.leader) return res.status(400).json({ success: false, error: 'No leader found.' });
      team.leader[field] = value.trim();
    } else {
      const idx = parseInt(index);
      if (isNaN(idx) || idx < 0 || idx >= (team.members?.length || 0)) {
        return res.status(400).json({ success: false, error: 'Invalid member index.' });
      }
      team.members[idx][field] = value.trim();
    }

    await team.save();
    return res.status(200).json({ success: true, leader: team.leader, members: team.members });

  } catch (err) {
    console.error('[admin/teams] member edit error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── PATCH /api/admin/teams/:id/mentor ────────────────────────────────────────
// Body: { mentorSession: true | false }
// Automatically recomputes totalAmount: 800 (no mentor) | 1100 (with mentor)
export async function teamMentorToggleHandler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, error: 'method_not_allowed' });
  if (!authGuard(req, res)) return;

  try {
    await connectDB();
    const { id } = req.params;
    const { mentorSession } = req.body || {};

    if (typeof mentorSession !== 'boolean') {
      return res.status(400).json({ success: false, error: 'mentorSession must be a boolean.' });
    }

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    const prevMentor = team.mentorSession;
    team.mentorSession = mentorSession;
    team.totalAmount   = mentorSession ? 1100 : 800;

    await team.save();
    console.log(`[admin/teams] Mentor toggle: ${team.teamName} → mentorSession=${mentorSession}, amount=₹${team.totalAmount} (was: ${prevMentor})`);
    return res.status(200).json({
      success: true,
      team: { _id: team._id, mentorSession: team.mentorSession, totalAmount: team.totalAmount },
    });

  } catch (err) {
    console.error('[admin/teams] mentor toggle error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
