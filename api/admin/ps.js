/**
 * Admin PS endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 * All admin routes require ADMIN_SECRET header to match process.env.ADMIN_SECRET.
 *
 * POST  /api/admin/ps/config       — Update drop window times / manual status
 * POST  /api/admin/ps/add-ps       — Add a problem statement
 * PATCH /api/admin/ps/update-ps    — Update an existing problem statement
 * DELETE/api/admin/ps/delete-ps    — Delete a problem statement
 * POST  /api/admin/ps/start-drop   — Force-start the drop now
 * POST  /api/admin/ps/stop-drop    — Force-close the drop
 * GET   /api/admin/ps/stats        — Current slot stats for all PS
 */

import { connectDB }         from '../lib/mongodb.js';
import { PSDropConfig }      from '../models/PSDropConfig.js';
import { ProblemStatement }  from '../models/ProblemStatement.js';
import { invalidatePSCache } from '../lib/psConfig.js';
import { emitDropStatus }    from '../lib/pusher.js';
import { psLog, getIP }      from '../lib/rateLimiter.js';

// ── Admin auth middleware ──────────────────────────────────────────────────────
function requireAdmin(req, res) {
  const secret = req.headers['x-admin-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    psLog(req, { event: 'admin_auth_failed', ip: getIP(req) });
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ps/config
// Body: { startTime?, endTime?, manualStatus? }
// ─────────────────────────────────────────────────────────────────────────────
export async function configHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const { startTime, endTime, manualStatus } = req.body || {};

  try {
    await connectDB();

    const update = {};
    if (startTime)     update.startTime    = new Date(startTime);
    if (endTime)       update.endTime      = new Date(endTime);
    if (manualStatus !== undefined) update.manualStatus = manualStatus || null;

    const cfg = await PSDropConfig.findByIdAndUpdate(
      'singleton',
      { $set: update },
      { upsert: true, new: true }
    );

    invalidatePSCache();
    psLog(req, { event: 'admin_config_update', update });

    return res.status(200).json({ success: true, config: cfg });
  } catch (err) {
    console.error('[admin/ps/config] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ps/add-ps
// Body: { title, order, slotsTotal?, description?, domain? }
// ─────────────────────────────────────────────────────────────────────────────
export async function addPsHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const { title, order, slotsTotal = 5, description = '', domain = '' } = req.body || {};

  if (!title || !order) {
    return res.status(400).json({ error: 'title and order are required' });
  }

  try {
    await connectDB();

    const ps = await ProblemStatement.create({
      title,
      order: parseInt(order),
      slotsTotal,
      description,
      domain,
    });
    psLog(req, { event: 'admin_add_ps', order, title });

    return res.status(201).json({
      success: true,
      ps: {
        id:          ps._id,
        order:       ps.order,
        title:       ps.title,
        description: ps.description,
        domain:      ps.domain,
        slotsTotal:  ps.slotsTotal,
        slotsTaken:  ps.slotsTaken,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'duplicate_order', message: `PS with order ${order} already exists.` });
    }
    console.error('[admin/ps/add-ps] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/ps/update-ps
// Body: { order, title?, description?, domain?, slotsTotal? }
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePsHandler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const { order, title, description, domain, slotsTotal } = req.body || {};

  if (!order) {
    return res.status(400).json({ error: 'order is required to identify the PS' });
  }

  try {
    await connectDB();

    const update = {};
    if (title       !== undefined) update.title       = title;
    if (description !== undefined) update.description = description;
    if (domain      !== undefined) update.domain      = domain;
    if (slotsTotal  !== undefined) update.slotsTotal  = parseInt(slotsTotal);

    const ps = await ProblemStatement.findOneAndUpdate(
      { order: parseInt(order) },
      { $set: update },
      { new: true }
    );

    if (!ps) return res.status(404).json({ error: 'ps_not_found' });

    invalidatePSCache();
    psLog(req, { event: 'admin_update_ps', order, update });

    return res.status(200).json({
      success: true,
      ps: {
        id:          ps._id,
        order:       ps.order,
        title:       ps.title,
        description: ps.description,
        domain:      ps.domain,
        slotsTotal:  ps.slotsTotal,
        slotsTaken:  ps.slotsTaken,
      },
    });
  } catch (err) {
    console.error('[admin/ps/update-ps] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/ps/delete-ps
// Body: { order }
// ─────────────────────────────────────────────────────────────────────────────
export async function deletePsHandler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  const { order } = req.body || {};

  if (!order) {
    return res.status(400).json({ error: 'order is required' });
  }

  try {
    await connectDB();

    const ps = await ProblemStatement.findOneAndDelete({ order: parseInt(order) });
    if (!ps) return res.status(404).json({ error: 'ps_not_found' });

    invalidatePSCache();
    psLog(req, { event: 'admin_delete_ps', order });

    return res.status(200).json({ success: true, deleted: { order: ps.order, title: ps.title } });
  } catch (err) {
    console.error('[admin/ps/delete-ps] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ps/start-drop
// Force-starts the drop right now
// ─────────────────────────────────────────────────────────────────────────────
export async function startDropHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    await connectDB();

    const now = new Date();
    await PSDropConfig.findByIdAndUpdate(
      'singleton',
      { $set: { manualStatus: 'active' } },
      { upsert: true }
    );

    invalidatePSCache();
    await emitDropStatus('drop-started', { startedAt: now.toISOString() });
    psLog(req, { event: 'admin_start_drop' });

    return res.status(200).json({ success: true, message: 'PS Drop is now ACTIVE.', startedAt: now });
  } catch (err) {
    console.error('[admin/ps/start-drop] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ps/stop-drop
// Force-closes the drop
// ─────────────────────────────────────────────────────────────────────────────
export async function stopDropHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    await connectDB();

    // Clear manual override — returns to the .env schedule automatically
    await PSDropConfig.findByIdAndUpdate(
      'singleton',
      { $set: { manualStatus: null } },
      { upsert: true }
    );

    invalidatePSCache();
    await emitDropStatus('drop-closed', { closedAt: new Date().toISOString() });
    psLog(req, { event: 'admin_stop_drop' });

    return res.status(200).json({ success: true, message: 'Manual override cleared. Returned to .env schedule.' });
  } catch (err) {
    console.error('[admin/ps/stop-drop] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/ps/stats
// Returns full slot stats for admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function statsHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    await connectDB();

    const [psList, cfg] = await Promise.all([
      ProblemStatement.find({}).sort({ order: 1 }).lean(),
      PSDropConfig.findById('singleton').lean(),
    ]);

    return res.status(200).json({
      config: cfg,
      psList: psList.map(ps => ({
        id:          ps._id,
        order:       ps.order,
        title:       ps.title,
        description: ps.description || '',
        domain:      ps.domain || '',
        slotsTaken:  ps.slotsTaken,
        slotsTotal:  ps.slotsTotal,
        isFull:      ps.slotsTaken >= ps.slotsTotal,
      })),
    });
  } catch (err) {
    console.error('[admin/ps/stats] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
