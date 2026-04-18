/**
 * api/lib/pusher.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pusher server-side client (singleton).
 * Emits real-time slot updates to the "ps-drop" channel.
 *
 * Required env vars:
 *   PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
 */

import Pusher from 'pusher';

let _pusher = null;

export function getPusher() {
  if (_pusher) return _pusher;

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    console.warn('⚠️  Pusher env vars missing — real-time updates disabled.');
    return null;
  }

  _pusher = new Pusher({
    appId:   PUSHER_APP_ID,
    key:     PUSHER_KEY,
    secret:  PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS:  true,
  });

  return _pusher;
}

/**
 * Emit a slot-update event after a successful PS selection.
 * Silently swallows errors so a Pusher outage never breaks selection.
 */
export async function emitSlotUpdate({ psOrder, slotsTaken, slotsTotal }) {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger('ps-drop', 'slot-update', {
      psOrder,
      slotsTaken,
      isFull: slotsTaken >= slotsTotal,
    });
  } catch (err) {
    console.error('Pusher emit failed (non-fatal):', err.message);
  }
}

/**
 * Emit a drop-status event (used by admin controls).
 */
export async function emitDropStatus(event, data = {}) {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger('ps-drop', event, data);
  } catch (err) {
    console.error('Pusher status emit failed (non-fatal):', err.message);
  }
}

/**
 * Emit a payment_confirmed event to the admin payments dashboard.
 * Subscribe on channel "payments", event "payment_confirmed".
 */
export async function emitPaymentConfirmed(team) {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger('payments', 'payment_confirmed', {
      teamCode:      team.code,
      teamName:      team.teamName,
      collegeName:   team.collegeName,
      leaderName:    team.leader?.name   || '',
      leaderEmail:   team.leader?.email  || '',
      amountPaid:    team.totalAmount,
      mentorSession: team.mentorSession  || false,
      paidAt:        (team.paymentDate || new Date()).toISOString(),
      cashfreeOrderId: team.cashfreeOrderId || '',
    });
  } catch (err) {
    console.error('Pusher payment_confirmed emit failed (non-fatal):', err.message);
  }
}

/**
 * Emit a payment_failed event to the admin payments dashboard.
 */
export async function emitPaymentFailed(team) {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger('payments', 'payment_failed', {
      teamCode:  team.code,
      teamName:  team.teamName,
      orderId:   team.cashfreeOrderId || '',
    });
  } catch (err) {
    console.error('Pusher payment_failed emit failed (non-fatal):', err.message);
  }
}

