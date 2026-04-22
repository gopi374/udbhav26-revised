/**
 * scripts/seed-admin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script: creates/updates the admin user in MongoDB Atlas with a
 * bcrypt-hashed password.
 *
 * Usage:
 *   node --env-file=.env scripts/seed-admin.js
 *
 * Run this once locally after any credential change. The hash is stored in
 * Atlas; ADMIN_PASS is then removed from the env entirely.
 */ 

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Inline model (avoids circular imports) ────────────────────────────────────
const schema = new mongoose.Schema(
  {
    username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, default: 'admin' },
    createdAt:    { type: Date, default: Date.now },
    lastLogin:    { type: Date },
  },
  { collection: 'adminusers' }
);

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', schema);

// ── Credentials to seed ───────────────────────────────────────────────────────
const USERNAME = 'admin01';
const PASSWORD = 'udbhavbyalta';
const SALT_ROUNDS = 12;

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI not set. Run: node --env-file=.env scripts/seed-admin.js');
    process.exit(1);
  }

  console.log('🔗  Connecting to MongoDB Atlas…');
  await mongoose.connect(uri);
  console.log('✅  Connected.\n');

  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  console.log(`🔑  Username : ${USERNAME}`);
  console.log(`🔒  Hash     : ${hash}\n`);

  const result = await AdminUser.findOneAndUpdate(
    { username: USERNAME },
    { username: USERNAME, passwordHash: hash, role: 'admin' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`✅  Admin user upserted in MongoDB Atlas:`);
  console.log(`    _id      : ${result._id}`);
  console.log(`    username : ${result.username}`);
  console.log(`    role     : ${result.role}`);
  console.log(`\n✅  Done! The plaintext password is NOT stored anywhere in the database.`);
  console.log(`    You can now remove ADMIN_PASS from your .env and Cloud Run env vars.\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
