/**
 * Payment mode, read from the environment on every call (so tests can switch it).
 *
 * - 'razorpay': RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set. Real checkout (test or live keys).
 * - 'stub':     keys missing on a local machine. Clearly labelled, nothing is charged, nothing refunded.
 * - 'disabled': keys missing on a Vercel deployment (production or preview). Refuses rather than stubbing,
 *               so a deploy that lost its keys can never hand out fake pledges or count fake money.
 *
 * Never log anything returned from here except `mode` and `keyMode`.
 */
export type PayMode = 'razorpay' | 'stub' | 'disabled';

export function deployed() {
  const v = process.env.VERCEL_ENV;
  return v === 'production' || v === 'preview' || process.env.NODE_ENV === 'production';
}

export function payConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
  const mode: PayMode = keyId && keySecret ? 'razorpay' : deployed() ? 'disabled' : 'stub';
  /** what a new pledge is recorded as: only 'live' money ever counts toward the public donation total */
  const keyMode: 'live' | 'test' | 'stub' = mode !== 'razorpay' ? 'stub' : keyId.startsWith('rzp_live_') ? 'live' : 'test';
  return { mode, keyMode, keyId, keySecret, webhookSecret };
}

export const cronSecret = () => process.env.CRON_SECRET?.trim() ?? '';
