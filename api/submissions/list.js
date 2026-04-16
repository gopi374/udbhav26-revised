/**
 * api/submissions/list.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/submissions/list
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from '../lib/mongodb.js';
import { Submission } from '../models/Submission.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Basic Admin Security check (consistent with other admin APIs)
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    await connectDB();

    const submissions = await Submission.find({}).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      submissions,
    });
  } catch (err) {
    console.error('[/api/submissions/list] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
