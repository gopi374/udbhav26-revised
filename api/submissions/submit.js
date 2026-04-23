/**
 * api/submissions/submit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/submissions/submit
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { connectDB } from '../lib/mongodb.js';
import { Submission } from '../models/Submission.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { teamId, type, submissionLink, description } = req.body || {};

  if (!teamId || !type || !submissionLink) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    await connectDB();

    // One-time: drop stale indexes (e.g. teamCode_1) that don't match schema
    if (!handler._indexesSynced) {
      await Submission.syncIndexes();
      handler._indexesSynced = true;
    }

    const newSubmission = await Submission.create({
      teamId,
      type,
      submissionLink,
      description,
    });

    return res.status(201).json({
      success: true,
      submission: newSubmission,
    });
  } catch (err) {
    console.error('[/api/submissions/submit] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
