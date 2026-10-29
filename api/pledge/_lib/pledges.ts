/**
 * Pledge bookkeeping in Firestore (Admin SDK; clients can only read their own `pledges/{id}`).
 *
 *   pledgeOrders/{orderId}  server-only: what was ordered (uid, amount, goal, tz), filled in by `create`
 *   pledgeUsers/{uid}       server-only: the one-active-pledge lock + a small order rate limit
 *   pledges/{orderId}       the pledge itself (the id is the Razorpay order id, so activation is idempotent)
 *   pledgeStats/public      public running totals for the charity card (live money only)
 *
 * Every state change is a transaction that re-reads the current state first, so any handler can be re-run
 * (double clicks, the webhook racing the browser, a cron retry) without doing anything twice.
 */
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  TERMS_VERSION,
  SETTLE_GRACE_MS,
  computeProgress,
  deadlineFor,
  goalSummary,
  windowStart,
  type Goal,
  type PledgeDoc,
  type PledgeStatus,
} from '../../../src/features/pledge/rules.js';
import { db } from './admin.js';
import { payConfig } from './env.js';
import { createOrder, refundInFull } from './razorpay.js';

interface OrderDoc {
  uid: string;
  amountPaise: number;
  goal: Goal;
  tz: string;
  mode: PledgeDoc['mode'];
  status: 'created' | 'activated';
  createdAt: number;
  termsVersion: string;
  paymentId?: string;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

const ORDER_GAP_MS = 10_000;
const ORDERS_PER_DAY = 20;

/* ------------------------------------------------------------------ create */

export type StartResult =
  | { ok: true; orderId: string; amountPaise: number; mode: 'razorpay' | 'stub'; keyId: string | null }
  | { ok: false; reason: 'active' | 'slow' | 'limit' };

export async function startOrder(uid: string, amountRupees: number, goal: Goal, tz: string): Promise<StartResult> {
  const cfg = payConfig();
  if (cfg.mode === 'disabled') throw new Error('payments disabled');
  const fs = db();
  const lockRef = fs.doc(`pledgeUsers/${uid}`);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  const check = await fs.runTransaction(async (tx) => {
    const lock = await tx.get(lockRef);
    const activeId = lock.get('activePledgeId');
    if (typeof activeId === 'string' && activeId) {
      const a = await tx.get(fs.doc(`pledges/${activeId}`));
      if (a.exists && a.get('status') === 'active') return 'active' as const;
    }
    if (now - num(lock.get('lastOrderAt')) < ORDER_GAP_MS) return 'slow' as const;
    const count = lock.get('ordersDay') === day ? num(lock.get('ordersCount')) : 0;
    if (count >= ORDERS_PER_DAY) return 'limit' as const;
    tx.set(lockRef, { lastOrderAt: now, ordersDay: day, ordersCount: count + 1 }, { merge: true });
    return 'ok' as const;
  });
  if (check !== 'ok') return { ok: false, reason: check };

  const amountPaise = amountRupees * 100;
  const orderId =
    cfg.mode === 'stub'
      ? `stub_order_${randomBytes(9).toString('hex')}`
      : await createOrder(amountPaise, `yfp_${uid.slice(0, 12)}_${now.toString(36)}`, {
          app: 'youfloww-pledge',
          uid,
          goal: goalSummary(goal),
          goalKind: goal.kind,
        });

  const order: OrderDoc = { uid, amountPaise, goal, tz, mode: cfg.keyMode, status: 'created', createdAt: now, termsVersion: TERMS_VERSION };
  await fs.doc(`pledgeOrders/${orderId}`).create(order);
  return { ok: true, orderId, amountPaise, mode: cfg.mode, keyId: cfg.mode === 'razorpay' ? cfg.keyId : null };
}

export async function getOrder(orderId: string) {
  const s = await db().doc(`pledgeOrders/${orderId}`).get();
  return s.exists ? (s.data() as OrderDoc) : null;
}

/* ------------------------------------------------------------------ activate */

export type ActivateResult =
  | { ok: true; pledgeId: string; status: PledgeStatus; duplicate: boolean }
  | { ok: false; reason: 'unknown-order' | 'other-payment' };

/**
 * Turn a paid order into a pledge. Call ONLY after the payment was verified with Razorpay (or in stub mode).
 * Idempotent: the browser callback and the webhook may both arrive. If the person somehow already has an
 * active pledge (two tabs paid at once), the new payment is recorded and refunded straight away.
 */
export async function activate(orderId: string, paymentId: string, via: 'checkout' | 'webhook'): Promise<ActivateResult> {
  const fs = db();
  const orderRef = fs.doc(`pledgeOrders/${orderId}`);
  const pledgeRef = fs.doc(`pledges/${orderId}`);
  const pre = await orderRef.get();
  if (!pre.exists) return { ok: false, reason: 'unknown-order' };
  const uid = (pre.data() as OrderDoc).uid;
  // Read outside the transaction: the app writes users/{uid} often and the baseline needn't be transactional.
  const user = await fs.doc(`users/${uid}`).get();
  const baselineFocusSeconds = Math.max(0, Math.round(num(user.get('totalFocusSeconds'))));

  const r = await fs.runTransaction(async (tx): Promise<ActivateResult> => {
    const o = (await tx.get(orderRef)).data() as OrderDoc;
    if (o.status === 'activated') {
      if (o.paymentId !== paymentId) return { ok: false, reason: 'other-payment' };
      const p = await tx.get(pledgeRef);
      return { ok: true, pledgeId: orderId, status: p.get('status'), duplicate: p.get('outcome') === 'duplicate' };
    }
    const lockRef = fs.doc(`pledgeUsers/${o.uid}`);
    const lock = await tx.get(lockRef);
    const activeId = lock.get('activePledgeId');
    let busy = false;
    if (typeof activeId === 'string' && activeId && activeId !== orderId) {
      const a = await tx.get(fs.doc(`pledges/${activeId}`));
      busy = a.exists && a.get('status') === 'active';
    }
    const now = Date.now();
    const base = {
      id: orderId,
      uid: o.uid,
      amountPaise: o.amountPaise,
      goal: o.goal,
      tz: o.tz,
      baselineFocusSeconds,
      orderId,
      paymentId,
      refundId: null,
      refundedAt: null,
      progressSeconds: null,
      daysMet: null,
      createdAt: now,
      mode: o.mode,
      termsVersion: o.termsVersion,
    };
    tx.update(orderRef, { status: 'activated', paymentId, activatedAt: now, via });
    if (busy) {
      tx.set(pledgeRef, { ...base, startAt: now, deadline: now, status: 'refund_pending', outcome: 'duplicate', settledAt: now });
      return { ok: true, pledgeId: orderId, status: 'refund_pending', duplicate: true };
    }
    const startAt = windowStart(o.goal, now, o.tz);
    tx.set(pledgeRef, { ...base, startAt, deadline: deadlineFor(o.goal, startAt, o.tz), status: 'active', outcome: null, settledAt: null });
    tx.set(lockRef, { activePledgeId: orderId }, { merge: true });
    return { ok: true, pledgeId: orderId, status: 'active', duplicate: false };
  });

  if (r.ok && r.duplicate) {
    const done = await refundPledge(orderId).catch(() => 'pending' as const);
    if (done === 'refunded') return { ...r, status: 'refunded' };
  }
  return r;
}

/* ------------------------------------------------------------------ settle */

/** Decide one pledge whose deadline has passed: met -> refund_pending, missed -> forfeited. */
export async function settleOne(id: string, now = Date.now()): Promise<PledgeStatus | 'not-due'> {
  const fs = db();
  const ref = fs.doc(`pledges/${id}`);
  const first = (await ref.get()).data() as PledgeDoc | undefined;
  if (!first || first.status !== 'active') return first?.status ?? 'not-due';
  if (first.deadline + SETTLE_GRACE_MS > now) return 'not-due';

  const user = await fs.doc(`users/${first.uid}`).get();
  const progress = computeProgress(first, user.exists ? user.data() : null, first.deadline);

  return fs.runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data() as PledgeDoc;
    if (p.status !== 'active') return p.status; // another run got here first
    const lockRef = fs.doc(`pledgeUsers/${p.uid}`);
    const lock = await tx.get(lockRef);
    const status: PledgeStatus = progress.met ? 'refund_pending' : 'forfeited';
    tx.update(ref, {
      status,
      outcome: progress.met ? 'met' : 'missed',
      progressSeconds: Math.round(progress.seconds),
      daysMet: progress.daysMet,
      settledAt: now,
    });
    if (lock.get('activePledgeId') === id) tx.update(lockRef, { activePledgeId: null });
    if (p.mode === 'live') {
      tx.set(
        fs.doc('pledgeStats/public'),
        progress.met
          ? { keptCount: FieldValue.increment(1), updatedAt: now }
          : { missedCount: FieldValue.increment(1), forfeitedPaise: FieldValue.increment(p.amountPaise), updatedAt: now },
        { merge: true },
      );
    }
    return status;
  });
}

const LEASE_MS = 2 * 60 * 1000;

/**
 * Refund a `refund_pending` pledge in full, at most once:
 * 1. a transaction takes a 2-minute lease (concurrent runs skip),
 * 2. Razorpay's existing refunds for the payment are adopted instead of creating another,
 * 3. the create call carries an idempotency key; Razorpay refuses to refund more than was captured,
 * 4. the refund id is stored and the status moves to 'refunded'. A failure leaves 'refund_pending' for the
 *    next daily run.
 */
export async function refundPledge(id: string): Promise<'refunded' | 'pending' | 'skipped'> {
  const fs = db();
  const ref = fs.doc(`pledges/${id}`);
  const now = Date.now();
  const lease = await fs.runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data() as (PledgeDoc & { refundLeaseUntil?: number; refundAttempts?: number }) | undefined;
    if (!p || p.status !== 'refund_pending') return null;
    if (num(p.refundLeaseUntil) > now) return null;
    const attempt = num(p.refundAttempts) + 1;
    tx.update(ref, { refundLeaseUntil: now + LEASE_MS, refundAttempts: attempt });
    return { p, attempt };
  });
  if (!lease) return 'skipped';
  const { p, attempt } = lease;

  try {
    let refundId: string;
    if (p.mode === 'stub') {
      refundId = `stub_rfnd_${id.slice(-12)}`;
    } else {
      const cfg = payConfig();
      if (cfg.mode !== 'razorpay') throw new Error('Razorpay keys are missing');
      if ((cfg.keyMode === 'live') !== (p.mode === 'live')) throw new Error(`pledge is ${p.mode} but the keys are ${cfg.keyMode}`);
      const r = await refundInFull(p.paymentId, p.amountPaise, `${id}_r${attempt}`, { app: 'youfloww-pledge', pledgeId: id, reason: p.outcome ?? 'met' });
      refundId = r.id;
    }
    await fs.runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data() as PledgeDoc;
      if (cur.status !== 'refund_pending') return;
      tx.update(ref, { status: 'refunded', refundId, refundedAt: Date.now(), refundLeaseUntil: 0, lastError: null });
    });
    return 'refunded';
  } catch (e) {
    console.error(`[pledge/refund] ${id}: ${errText(e)}`);
    await ref.update({ refundLeaseUntil: 0, lastError: errText(e) }).catch(() => {});
    return 'pending';
  }
}

/** The daily cron: settle every pledge past its deadline (+ grace) and retry refunds that are still pending. */
export async function settleDue(now = Date.now()) {
  const fs = db();
  const snap = await fs.collection('pledges').where('status', 'in', ['active', 'refund_pending']).limit(400).get();
  const out = { due: 0, waiting: 0, refunded: 0, forfeited: 0, refundsPending: 0, errors: 0 };
  for (const doc of snap.docs) {
    const p = doc.data() as PledgeDoc;
    try {
      if (p.status === 'active') {
        if (p.deadline + SETTLE_GRACE_MS > now) {
          out.waiting++;
          continue;
        }
        out.due++;
        const s = await settleOne(doc.id, now);
        if (s === 'forfeited') out.forfeited++;
        if (s !== 'refund_pending') continue;
      }
      const r = await refundPledge(doc.id);
      if (r === 'refunded') out.refunded++;
      else out.refundsPending++;
    } catch (e) {
      out.errors++;
      console.error(`[pledge/settle] ${doc.id}: ${errText(e)}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ webhook facts */

/** refund.processed / refund.failed for a refund we created. */
export async function noteRefundEvent(pledgeId: string, refundId: string, event: 'processed' | 'failed') {
  const fs = db();
  const ref = fs.doc(`pledges/${pledgeId}`);
  await fs.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const p = s.data() as PledgeDoc | undefined;
    if (!p || p.refundId !== refundId) return;
    if (event === 'processed') tx.update(ref, { refundProcessedAt: Date.now() });
    // a failed refund goes back in the queue; the next daily run tries again with a new attempt
    else if (p.status === 'refunded') tx.update(ref, { status: 'refund_pending', refundId: null, lastError: 'refund failed at the bank' });
  });
}
