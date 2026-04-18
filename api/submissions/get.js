/**
 * api/submissions/get.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/submissions/get?code=UDB-XXXX
 * Public — returns the submission for a given team code (no auth required).
 * Used by the team dashboard to pre-fill the form.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB }  from '../lib/mongodb.js';
import { Submission } from '../models/Submission.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const code = String(req.query?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code_required' });

  try {
    await connectDB();
    const sub = await Submission.findOne({ teamCode: code }).lean();
    if (!sub) return res.status(200).json({ submission: null });

    return res.status(200).json({
      submission: {
        teamCode:  sub.teamCode,
        pptLink:   sub.pptLink  || '',
        liveLink:  sub.liveLink || '',
        submittedAt: sub.submittedAt,
      },
    });
  } catch (err) {
    console.error('[submissions/get]', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
