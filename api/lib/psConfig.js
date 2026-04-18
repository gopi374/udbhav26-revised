/**
 * api/lib/psConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PS Drop state reader.
 *
 * Schedule comes from ENV VARS (PS_DROP_START / PS_DROP_END) — edit .env to
 * change the drop window. No database writes needed for scheduling.
 *
 * Manual override (start/stop buttons in admin) is stored in MongoDB
 * PSDropConfig.manualStatus — this takes priority over the schedule.
 */

import { connectDB }    from './mongodb.js';
import { PSDropConfig } from '../models/PSDropConfig.js';

// ── Parse schedule from env ───────────────────────────────────────────────────
// Fallback: far-future / far-past so default state is pre-drop if not set
const ENV_START = process.env.PS_DROP_START ? new Date(process.env.PS_DROP_START) : new Date('2099-01-01T00:00:00Z');
const ENV_END   = process.env.PS_DROP_END   ? new Date(process.env.PS_DROP_END)   : new Date('2099-01-01T01:00:00Z');

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache     = null;
let _cacheTime = 0;
const TTL_MS   = 10_000; // 10 seconds

/**
 * Returns the current PS drop state object:
 * {
 *   state: "pre-drop" | "active" | "closed",
 *   startTime: Date,   ← from .env
 *   endTime:   Date,   ← from .env
 *   now:       Date,
 *   manualOverride: boolean,
 * }
 *
 * Priority: manualStatus (DB) > ENV schedule
 */
export async function getPSState() {
  const now = new Date();

  // Return cached value if still fresh
  if (_cache && Date.now() - _cacheTime < TTL_MS) {
    return { ..._cache, now };
  }

  // Check for manual override in DB
  let manualStatus   = null;
  let manualOverride = false;

  try {
    await connectDB();
    const cfg = await PSDropConfig.findById('singleton').lean();
    if (cfg?.manualStatus) {
      manualStatus   = cfg.manualStatus; // 'active' | 'closed'
      manualOverride = true;
    }
  } catch (err) {
    console.warn('[psConfig] DB read failed, falling back to env schedule:', err.message);
  }

  let state;
  if (manualOverride) {
    state = manualStatus;
  } else if (now < ENV_START) {
    state = 'pre-drop';
  } else if (now < ENV_END) {
    state = 'active';
  } else {
    state = 'closed';
  }

  _cache = {
    state,
    startTime: ENV_START,
    endTime:   ENV_END,
    manualOverride,
  };
  _cacheTime = Date.now();

  return { ..._cache, now };
}

/** Force-invalidate the cache (call after admin start/stop drop). */
export function invalidatePSCache() {
  _cache     = null;
  _cacheTime = 0;
}
