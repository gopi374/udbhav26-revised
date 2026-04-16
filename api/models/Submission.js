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
      enum: ['ppt-submission', 'project-submission', 'other'],
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

// Prevent re-compiling model on hot-reload
export const Submission =
  mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
