/**
 * api/models/Submission.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose schema for team submissions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema(
  {
    teamId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['ppt-submission', 'project-submission', 'github-submission', 'other'],
      required: true,
    },
    submissionLink: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    collection: 'submissions',
  }
);

// Force re-compiling model on hot-reload to catch schema changes
if (mongoose.models.Submission) {
  delete mongoose.models.Submission;
}
export const Submission = mongoose.model('Submission', SubmissionSchema);

// Drop stale indexes (e.g. teamCode_1) that no longer match the schema
Submission.syncIndexes().catch(err =>
  console.warn('[Submission] syncIndexes warning (non-fatal):', err.message)
);
