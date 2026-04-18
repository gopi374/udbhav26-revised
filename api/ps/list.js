/**
 * GET /api/ps/list
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the PS list with current slot counts.
 * SECURITY: titles are NEVER returned unless state === "active".
 * Public endpoint — no team code required.
 *
 * Rate limit: 60 requests per IP per minute
 * Response: { psList: [{ order, title, slotsTaken, slotsTotal, isFull }] }
 */

import { connectDB }               from '../lib/mongodb.js';
import { ProblemStatement }        from '../models/ProblemStatement.js';
import { getPSState }              from '../lib/psConfig.js';
import { rateLimit, getIP, psLog } from '../lib/rateLimiter.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const ip = getIP(req);

  // ── Rate limit ─────────────────────────────────────────────────────────────
  if (!rateLimit(`list:ip:${ip}`, 60, 60)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  // ── State guard — no PS titles before drop is active ──────────────────────
  try {
    const psState = await getPSState();
    if (psState.state !== 'active') {
      return res.status(403).json({
        error:   'not_active',
        state:   psState.state,
        message: 'PS list is not available yet.',
      });
    }
  } catch (err) {
    console.error('[ps/list] state check error:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  psLog(req, { event: 'ps_list', ip });

  try {
    await connectDB();

    // Fetch all PS in order — include description and domain now that drop is active
    const psList = await ProblemStatement.find({}, 'order title description domain slotsTaken slotsTotal').sort({ order: 1 }).lean();

    const response = psList.map(ps => ({
      id:          ps.order,
      order:       ps.order,
      title:       ps.title,
      description: ps.description || '',
      domain:      ps.domain      || '',
      slotsTaken:  ps.slotsTaken,
      slotsTotal:  ps.slotsTotal,
      isFull:      ps.slotsTaken >= ps.slotsTotal,
    }));

    // Short cache for polling (2s)
    res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=3');
    return res.status(200).json({ psList: response });

  } catch (err) {
    console.error('[ps/list] error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
