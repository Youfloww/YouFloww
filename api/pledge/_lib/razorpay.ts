/**
 * Razorpay REST calls (orders, payments, refunds) with plain fetch. Same proven pattern as giftasite's
 * src/lib/payments.ts: signatures are HMAC-SHA256 checked in constant time, and a payment only counts after
 * Razorpay itself says it is captured, in full, in INR, on the right order.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { payConfig } from './env.js';

const API = 'https://api.razorpay.com/v1';

function auth() {
  const { keyId, keySecret } = payConfig();
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

/** A short, secret-free reason for logs and stored `lastError`. */
async function failure(what: string, res: Response) {
  let desc = '';
  try {
    const j = (await res.json()) as { error?: { description?: string } };
    desc = String(j?.error?.description ?? '').slice(0, 120);
  } catch {
    /* not json */
  }
  return new Error(`${what} failed (${res.status})${desc ? `: ${desc}` : ''}`);
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<string> {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth() },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40), notes }),
  });
  if (!res.ok) throw await failure('Razorpay order', res);
  const body = (await res.json()) as { id?: string; amount?: number; currency?: string };
  if (!body.id || body.amount !== amountPaise || body.currency !== 'INR') throw new Error('Razorpay order response did not match');
  return body.id;
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { mode, keySecret } = payConfig();
  if (mode !== 'razorpay') return false;
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). No secret configured = nothing verifies. */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const { webhookSecret } = payConfig();
  if (!webhookSecret || !signature) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

interface Payment {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  amount_refunded?: number;
}

/**
 * Ask Razorpay what really happened, never the browser. A valid signature proves the payment belongs to the
 * order, not that money was taken. An "authorized" payment is captured here (otherwise Razorpay auto-refunds
 * it days later); only a captured payment of the exact amount on the exact order counts.
 */
export async function confirmCapturedPayment(paymentId: string, orderId: string, amountPaise: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (payConfig().mode !== 'razorpay') return { ok: false, reason: 'payments not configured' };
  const url = `${API}/payments/${encodeURIComponent(paymentId)}`;
  const res = await fetch(url, { headers: { Authorization: auth() }, cache: 'no-store' });
  if (!res.ok) return { ok: false, reason: `lookup failed (${res.status})` };
  let p = (await res.json()) as Payment;
  if (p.order_id !== orderId) return { ok: false, reason: 'payment is for a different order' };
  if (p.amount !== amountPaise || p.currency !== 'INR') return { ok: false, reason: 'amount mismatch' };
  if (p.status === 'authorized') {
    const cap = await fetch(`${url}/capture`, {
      method: 'POST',
      headers: { Authorization: auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR' }),
    });
    if (!cap.ok) return { ok: false, reason: `capture failed (${cap.status})` };
    p = (await cap.json()) as Payment;
  }
  if (p.status !== 'captured') return { ok: false, reason: `payment is ${p.status}` };
  if (p.amount !== amountPaise || p.order_id !== orderId) return { ok: false, reason: 'amount mismatch' };
  return { ok: true };
}

interface Refund {
  id: string;
  amount: number;
  status: string;
}

/**
 * Full refund, at most once. Before creating a refund it asks Razorpay for the payment's existing refunds and
 * adopts one if it exists (a previous attempt may have succeeded after our request timed out). The create call
 * also carries an idempotency key, and Razorpay itself refuses to refund more than was captured.
 */
export async function refundInFull(paymentId: string, amountPaise: number, idempotencyKey: string, notes: Record<string, string>): Promise<{ id: string; adopted: boolean }> {
  const base = `${API}/payments/${encodeURIComponent(paymentId)}`;
  const list = await fetch(`${base}/refunds?count=20`, { headers: { Authorization: auth() }, cache: 'no-store' });
  if (!list.ok) throw await failure('Razorpay refund lookup', list);
  const items = ((await list.json()) as { items?: Refund[] }).items ?? [];
  const existing = items.find((r) => r.status !== 'failed');
  if (existing) return { id: existing.id, adopted: true };

  const res = await fetch(`${base}/refund`, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json', 'X-Refund-Idempotency': idempotencyKey },
    body: JSON.stringify({ amount: amountPaise, speed: 'normal', receipt: idempotencyKey.slice(0, 40), notes }),
  });
  if (!res.ok) throw await failure('Razorpay refund', res);
  const r = (await res.json()) as Partial<Refund>;
  if (!r.id) throw new Error('Razorpay refund response had no id');
  return { id: r.id, adopted: false };
}
