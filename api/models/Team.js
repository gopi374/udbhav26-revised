/**
 * api/models/Team.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-populated by admin — contains shortlisted teams with their unique codes.
 * When a user enters their team code on the register page, this collection
 * is queried to verify eligibility and prefill registration details.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema(
  {
    // ── Unique Code ────────────────────────────────────────────────────────
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      // e.g. "UDB26-001", "UDB26-042"
    },

    // ── Team Details ──────────────────────────────────────────────────────
    teamName:    { type: String, required: true, trim: true },
    collegeName: { type: String, required: true, trim: true },
    branch:      { type: String, required: true, trim: true },
    memberCount: { type: Number, required: true, min: 2, max: 4 },

    // ── Leader contact (for Razorpay prefill) ─────────────────────────────
    leader: {
      name:  { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },

    // ── Add-ons & Pricing ─────────────────────────────────────────────────
    mentorSession: { type: Boolean, default: false },
    totalAmount:   { type: Number, required: true },   // ₹800 or ₹1100

    // ── Status ────────────────────────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    registrationId: { type: String, default: null }, // MongoDB _id from Registration collection after payment
  },
  {
    timestamps: true,
    collection: 'teams',
  }
);

export const Team =
  mongoose.models.Team || mongoose.model('Team', TeamSchema);
