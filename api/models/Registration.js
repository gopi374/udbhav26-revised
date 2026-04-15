/**
 * api/models/Registration.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose schema for UDBHAV'26 Round 2 team registrations.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
});

const RegistrationSchema = new mongoose.Schema(
  {
    // ── Team Info ───────────────────────────────────────────────────────
    teamName:    { type: String, required: true, trim: true },
    collegeName: { type: String, required: true, trim: true },
    branch:      { type: String, required: true, trim: true },
    yearOfStudy: { type: String, required: true },

    // ── Leader ──────────────────────────────────────────────────────────
    leader: { type: MemberSchema, required: true },

    // ── Team Members (1 required, up to 3 optional) ─────────────────────
    members: {
      type: [MemberSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 3,
        message: 'A team must have between 1 and 3 additional members.',
      },
    },

    // ── Add-ons ─────────────────────────────────────────────────────────
    mentorSession: { type: Boolean, default: false },

    // ── Payment ─────────────────────────────────────────────────────────
    totalAmount: { type: Number, required: true },       // ₹800 or ₹1100
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

    // ── Meta ────────────────────────────────────────────────────────────
    ipAddress:   { type: String, default: null },
    userAgent:   { type: String, default: null },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    collection: 'registrations',
  }
);

// Prevent re-compiling model on hot-reload (Vercel / Next.js pattern)
export const Registration =
  mongoose.models.Registration ||
  mongoose.model('Registration', RegistrationSchema);
