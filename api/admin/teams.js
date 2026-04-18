/**
 * api/admin/teams.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin CRUD for the teams collection.
 * All routes require X-Admin-Secret header.
 *
 *  GET    /api/admin/teams              — list all teams (paginated + filtered)
 *  POST   /api/admin/teams              — add one team
 *  POST   /api/admin/teams/import       — bulk import array of teams
 *  PATCH  /api/admin/teams/:id          — edit team (code locked if codeGenerated)
 *  DELETE /api/admin/teams/:id          — delete (blocked if paid)
 *  POST   /api/admin/teams/generate-codes — generate codes for teams without one
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }  from '../lib/mongodb.js';
import { Team }       from '../models/Team.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function authGuard(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

/** Generate a UDB-XXXX style code that isn't already in DB */
async function generateUniqueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code   = `UDB-${suffix}`;
    const exists = await Team.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique code after 20 attempts');
}

// ── LIST  GET /api/admin/teams ────────────────────────────────────────────────
export async function teamsListHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();

    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(200, parseInt(req.query.limit || '100'));
    const status = req.query.status || 'all';
    const q      = (req.query.q || '').trim();

    const filter = {};
    if (status !== 'all') filter.paymentStatus = status;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { teamName:    re },
        { collegeName: re },
        { code:        re },
        { 'leader.name':  re },
        { 'leader.email': re },
      ];
    }

    const [teams, total] = await Promise.all([
      Team.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Team.countDocuments(filter),
    ]);

    const stats = {
      total:       await Team.countDocuments(),
      paid:        await Team.countDocuments({ paymentStatus: 'paid' }),
      pending:     await Team.countDocuments({ paymentStatus: 'pending' }),
      codedCount:  await Team.countDocuments({ codeGenerated: true }),
    };

    return res.status(200).json({
      success: true,
      teams,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    });
  } catch (err) {
    console.error('[admin/teams] list error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── ADD ONE  POST /api/admin/teams ────────────────────────────────────────────
export async function teamsAddHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { teamName, collegeName, branch, memberCount, leader, mentorSession } = req.body || {};

    if (!teamName || !collegeName || !branch || !leader?.name || !leader?.email || !leader?.phone) {
      return res.status(400).json({ success: false, error: 'teamName, collegeName, branch, leader.name/email/phone are required.' });
    }

    const totalAmount = mentorSession ? 1100 : 800;
    const team = await Team.create({
      teamName, collegeName, branch,
      memberCount: memberCount || 1,
      leader, mentorSession: !!mentorSession, totalAmount,
    });

    return res.status(201).json({ success: true, team });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Duplicate team code.' });
    console.error('[admin/teams] add error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── BULK IMPORT  POST /api/admin/teams/import ─────────────────────────────────
export async function teamsImportHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const rows = req.body?.teams;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide a non-empty teams array.' });
    }
    if (rows.length > 200) {
      return res.status(400).json({ success: false, error: 'Max 200 teams per import.' });
    }

    const docs    = [];
    const skipped = [];

    for (const row of rows) {
      const { teamName, collegeName, branch, memberCount, leader, mentorSession } = row;
      if (!teamName || !collegeName || !branch || !leader?.name || !leader?.email || !leader?.phone) {
        skipped.push({ row, reason: 'Missing required fields' });
        continue;
      }
      docs.push({
        teamName:     teamName.trim(),
        collegeName:  collegeName.trim(),
        branch:       branch.trim(),
        memberCount:  parseInt(memberCount) || 1,
        leader: {
          name:  leader.name.trim(),
          email: leader.email.trim().toLowerCase(),
          phone: leader.phone.trim(),
        },
        mentorSession: !!mentorSession,
        totalAmount:   mentorSession ? 1100 : 800,
      });
    }

    const inserted = await Team.insertMany(docs, { ordered: false });

    return res.status(200).json({
      success:  true,
      imported: inserted.length,
      skipped:  skipped.length,
      details:  skipped,
    });
  } catch (err) {
    console.error('[admin/teams] import error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── UPDATE  PATCH /api/admin/teams/:id ───────────────────────────────────────
export async function teamsUpdateHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { id }    = req.params;
    const team      = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    const updates = req.body || {};

    // Block code change if already generated
    if (updates.code && team.codeGenerated) {
      return res.status(403).json({ success: false, error: 'Team code is immutable once generated.' });
    }

    // Block editing core fields once paid
    const lockedIfPaid = ['teamName', 'collegeName', 'branch', 'leader'];
    if (team.paymentStatus === 'paid') {
      for (const field of lockedIfPaid) {
        if (updates[field] !== undefined) {
          return res.status(403).json({ success: false, error: `Cannot edit '${field}' after payment is completed.` });
        }
      }
    }

    // Apply allowed updates
    const allowed = ['teamName', 'collegeName', 'branch', 'memberCount', 'leader', 'mentorSession', 'totalAmount', 'paymentStatus', 'members'];
    for (const key of allowed) {
      if (updates[key] !== undefined) team[key] = updates[key];
    }

    await team.save();
    return res.status(200).json({ success: true, team });
  } catch (err) {
    console.error('[admin/teams] update error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── DELETE  DELETE /api/admin/teams/:id ──────────────────────────────────────
export async function teamsDeleteHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { id } = req.params;
    const team   = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    if (team.paymentStatus === 'paid') {
      return res.status(403).json({ success: false, error: 'Cannot delete a team that has completed payment.' });
    }

    await team.deleteOne();
    return res.status(200).json({ success: true, message: 'Team deleted.' });
  } catch (err) {
    console.error('[admin/teams] delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── GENERATE CODES  POST /api/admin/teams/generate-codes ─────────────────────
export async function generateCodesHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();

    // First: sync any team that already has a code but the flag is not set
    await Team.updateMany(
      { code: { $exists: true, $ne: null, $ne: '' }, codeGenerated: { $ne: true } },
      { $set: { codeGenerated: true } }
    );

    // Then: generate codes for teams that have NO code yet
    const uncodedTeams = await Team.find({ $or: [{ code: { $exists: false } }, { code: null }, { code: '' }] });

    if (uncodedTeams.length === 0) {
      const synced = await Team.countDocuments({ codeGenerated: true });
      return res.status(200).json({
        success: true,
        message: `All teams already have codes (${synced} total active codes).`,
        generated: 0,
        synced,
      });
    }

    let generated = 0;
    const results = [];

    for (const team of uncodedTeams) {
      const code = await generateUniqueCode();
      team.code          = code;
      team.codeGenerated = true;
      await team.save();
      generated++;
      results.push({ id: team._id, teamName: team.teamName, code });
    }

    console.log(`[admin/teams] Generated ${generated} team codes`);
    return res.status(200).json({ success: true, generated, teams: results });
  } catch (err) {
    console.error('[admin/teams] generate-codes error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
