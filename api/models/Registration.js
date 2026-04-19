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
    collegeName: { type: String, required: false, trim: true, default: '' },
    branch:      { type: String, required: false, trim: true, default: '' },
    yearOfStudy: { type: String, required: false, default: 'N/A' },

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
    paymentScreenshotUrl: { type: String, required: false },
    cashfreeOrderId:   { type: String, default: null },
    cashfreePaymentId: { type: String, default: null },

    // Legacy — kept for historical records (Razorpay era)
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

    // ── Team Code (generated after payment confirmation) ─────────────────
    teamCode: {
      type:   String,
      default: null,
      unique:  true,
      sparse:  true,   // allows multiple null values
      uppercase: true,
      trim:   true,
    },

    // ── Meta ────────────────────────────────────────────────────────────
    ipAddress:   { type: String, default: null },
    userAgent:   { type: String, default: null },

    // ── Registration Status ─────────────────────────────────────────────
    registrationCompleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    collection: 'registrations',
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// teamCode already has unique+sparse index declared inline above.
// These compound/single-field indexes cover the admin query patterns.

// Fast lookup by payment status (admin dashboard filter, paid count)
RegistrationSchema.index({ paymentStatus: 1 });

// Fast duplicate check in register.js (teamName + leader email)
RegistrationSchema.index({ teamName: 1, 'leader.email': 1 });

// Cashfree order/payment ID lookup
RegistrationSchema.index({ cashfreeOrderId: 1 },   { sparse: true });
RegistrationSchema.index({ cashfreePaymentId: 1 },  { sparse: true });
// Legacy Razorpay indexes (kept for existing records)
RegistrationSchema.index({ razorpayOrderId: 1 },   { sparse: true });
RegistrationSchema.index({ razorpayPaymentId: 1 },  { sparse: true });

// Sort by creation date (admin registrations table default order)
RegistrationSchema.index({ createdAt: -1 });

// Prevent re-compiling model on hot-reload (Vercel / Next.js pattern)
export const Registration =
  mongoose.models.Registration ||
  mongoose.model('Registration', RegistrationSchema);
