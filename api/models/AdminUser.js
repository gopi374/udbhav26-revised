/**
 * api/models/AdminUser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose model for admin panel credentials.
 * Passwords are stored as bcrypt hashes — plaintext is NEVER persisted.
 *
 * Collection: adminusers
 */

import mongoose from 'mongoose';

const AdminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: 'admin',
      enum: ['admin', 'superadmin'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
    },
  },
  { collection: 'adminusers' }
);

export default mongoose.models.AdminUser ||
  mongoose.model('AdminUser', AdminUserSchema);
