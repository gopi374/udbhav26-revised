/**
 * api/admin/registrations.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin API for the REGISTRATIONS collection (actual submitted data).
 *
 *  GET    /api/admin/registrations       — list all registrations (paginated)
 *  PATCH  /api/admin/registrations/:id   — update paymentStatus
 *  DELETE /api/admin/registrations/:id   — delete registration
 *
 * NOTE: This is separate from /api/admin/teams which manages pre-imported
 * shortlisted teams. This endpoint shows all submitted registration forms.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }    from '../lib/mongodb.js';
import { Registration } from '../models/Registration.js';
import { Team }         from '../models/Team.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
function authGuard(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// ── LIST  GET /api/admin/registrations ────────────────────────────────────────
export async function registrationsListHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();

    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(200, parseInt(req.query.limit || '50'));
    const status = req.query.status || 'all';
    const q      = (req.query.q || '').trim();

    const filter = {};
    if (status !== 'all') filter.paymentStatus = status;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { teamName:         re },
        { collegeName:      re },
        { teamCode:         re },
        { 'leader.name':    re },
        { 'leader.email':   re },
      ];
    }

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Registration.countDocuments(filter),
    ]);

    const [totalAll, paid, pending, membersAgg] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({ paymentStatus: 'paid' }),
      Registration.countDocuments({ paymentStatus: 'pending' }),
      Registration.aggregate([
        { $project: { memberCount: { $add: [{ $size: { $ifNull: ["$members", []] } }, 1] } } },
        { $group: { _id: null, totalMembers: { $sum: "$memberCount" } } }
      ])
    ]);

    const totalMembers = membersAgg.length > 0 ? membersAgg[0].totalMembers : 0;

    console.log(`[admin/registrations] List: total=${total}, page=${page}, status=${status}, q="${q}"`);

    return res.status(200).json({
      success: true,
      registrations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { total: totalAll, paid, pending, totalMembers },
    });
  } catch (err) {
    console.error('[admin/registrations] list error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── UPDATE PAYMENT  PATCH /api/admin/registrations/:id ───────────────────────
export async function registrationUpdateHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { id } = req.params;
    const { paymentStatus } = req.body || {};

    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid paymentStatus. Use: pending, paid, failed.' });
    }

    // Fetch BEFORE update so we always have teamCode
    const existing = await Registration.findById(id).lean();
    if (!existing) return res.status(404).json({ success: false, error: 'Registration not found.' });

    const reg = await Registration.findByIdAndUpdate(
      id,
      { $set: { paymentStatus } },
      { new: true }
    );

    // Sync to Teams collection by teamCode
    const teamCode = existing.teamCode;
    console.log(`[admin/registrations] Updating paymentStatus=${paymentStatus} for id=${id}, teamCode=${teamCode}`);

    if (teamCode) {
      const teamResult = await Team.findOneAndUpdate(
        { code: teamCode },
        { $set: { paymentStatus } },
        { new: true }
      );
      if (teamResult) {
        console.log(`[admin/registrations] Synced Team ${teamCode} paymentStatus → ${paymentStatus}`);
      } else {
        console.warn(`[admin/registrations] No Team found with code=${teamCode} to sync`);
      }
    } else {
      console.warn(`[admin/registrations] Registration ${id} has no teamCode — cannot sync to Teams collection`);
    }

    return res.status(200).json({ success: true, registration: reg });
  } catch (err) {
    console.error('[admin/registrations] update error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── DELETE  DELETE /api/admin/registrations/:id ───────────────────────────────
export async function registrationDeleteHandler(req, res) {
  if (!authGuard(req, res)) return;
  try {
    await connectDB();
    const { id } = req.params;
    const reg = await Registration.findById(id);
    if (!reg) return res.status(404).json({ success: false, error: 'Registration not found.' });

    if (reg.paymentStatus === 'paid') {
      return res.status(403).json({ success: false, error: 'Cannot delete a paid registration.' });
    }

    await reg.deleteOne();
    return res.status(200).json({ success: true, message: 'Registration deleted.' });
  } catch (err) {
    console.error('[admin/registrations] delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
