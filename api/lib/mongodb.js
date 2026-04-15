/**
 * api/lib/mongodb.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cached Mongoose connection for Vercel Serverless Functions.
 * Serverless functions spin up fresh Node.js processes per invocation, so
 * we cache the connection on `global` to avoid opening thousands of
 * connections to MongoDB Atlas on every request.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    '⚠️  Please set MONGODB_URI in your .env file (local) or Vercel Environment Variables (production).'
  );
}

/**
 * Global cache — persisted across hot-reloads in development
 * and across invocations of the same warm Lambda in production.
 */
let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  // Already connected — return immediately
  if (cached.conn) {
    return cached.conn;
  }

  // Connection in progress — wait for it
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,   // fail fast if not connected
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => m)
      .catch((err) => {
        cached.promise = null; // reset so next request retries
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
