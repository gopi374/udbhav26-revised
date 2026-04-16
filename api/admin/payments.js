/**
 * api/admin/payments.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Payments endpoint — reads Cashfree payment data from the
 * Team collection (single source of truth).
 *
 * GET /api/admin/payments
 *   Query: status, search, page, limit, sort
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from '../lib/mongodb.js';
import { Team }      from '../models/Team.js';

function requireAdmin(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function paymentsHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    await connectDB();

    const {
      status = 'all',
      search = '',
      page   = 1,
      limit  = 30,
      sort   = 'newest',
    } = req.query || {};

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));
    const skip     = (pageNum - 1) * limitNum;

    // ── Build filter ─────────────────────────────────────────────────────────
    const filter = {};
    if (status !== 'all') filter.paymentStatus = status;

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { teamName:          { $regex: q, $options: 'i' } },
        { code:              { $regex: q, $options: 'i' } },
        { cashfreeOrderId:   { $regex: q, $options: 'i' } },
        { cashfreePaymentId: { $regex: q, $options: 'i' } },
        { 'leader.email':    { $regex: q, $options: 'i' } },
        { 'leader.name':     { $regex: q, $options: 'i' } },
      ];
    }

    // ── Sort ─────────────────────────────────────────────────────────────────
    const sortMap = {
      newest:      { createdAt:   -1 },
      oldest:      { createdAt:    1 },
      amount_desc: { totalAmount: -1 },
      amount_asc:  { totalAmount:  1 },
    };
    const sortQuery = sortMap[sort] || sortMap.newest;

    // ── Query ─────────────────────────────────────────────────────────────────
    const [teams, totalCount] = await Promise.all([
      Team.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .select('teamName collegeName leader totalAmount paymentStatus cashfreeOrderId cashfreePaymentId code mentorSession paymentDate members createdAt updatedAt')
        .lean(),
      Team.countDocuments(filter),
    ]);

    // ── Aggregate stats (full dataset) ────────────────────────────────────────
    const [statsResult] = await Team.aggregate([
      {
        $group: {
          _id:          null,
          totalRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
          totalPaid:    { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid']    }, 1, 0] } },
          totalPending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
          totalFailed:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed']  }, 1, 0] } },
          totalCount:   { $sum: 1 },
          avgAmount:    { $avg: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', null] } },
        },
      },
    ]);

    const stats = statsResult || {
      totalRevenue: 0, totalPaid: 0, totalPending: 0,
      totalFailed: 0, totalCount: 0, avgAmount: 0,
    };

    // ── Map to clean payment records ──────────────────────────────────────────
    const payments = teams.map(t => ({
      id:                 t._id,
      teamName:           t.teamName,
      collegeName:        t.collegeName,
      leaderName:         t.leader?.name  || '—',
      leaderEmail:        t.leader?.email || '—',
      leaderPhone:        t.leader?.phone || '—',
      amount:             t.totalAmount,
      paymentStatus:      t.paymentStatus,
      cashfreeOrderId:    t.cashfreeOrderId  || null,
      cashfreePaymentId:  t.cashfreePaymentId || null,
      teamCode:           t.code || null,
      mentorSession:      t.mentorSession || false,
      memberCount:        (t.members?.length || 0) + 1,
      paymentDate:        t.paymentDate || null,
      createdAt:          t.createdAt,
      updatedAt:          t.updatedAt,
    }));

    return res.status(200).json({
      payments,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total:      totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      stats: {
        totalRevenue: stats.totalRevenue,
        totalPaid:    stats.totalPaid,
        totalPending: stats.totalPending,
        totalFailed:  stats.totalFailed,
        totalCount:   stats.totalCount,
        avgAmount:    Math.round(stats.avgAmount || 0),
      },
    });

  } catch (err) {
    console.error('[admin/payments] error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}
