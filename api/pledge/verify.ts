/**
 * POST /api/pledge/verify  (Authorization: Bearer <Firebase ID token>)
 * body: { orderId, paymentId, signature }   (Razorpay Checkout's handler response)
 *       { orderId }                          (local STUB mode only)
 *
 * 1. the order must be this person's, 2. the checkout signature must be valid (HMAC), 3. Razorpay itself must
 * say the payment is captured for the full amount on that order. Only then is the pledge written.
 */
import { verifyUser } from './_lib/admin.js';
import { payConfig } from './_lib/env.js';
import { fail, guard, json, readJson } from './_lib/http.js';
import { activate, chargeOf, getOrder } from './_lib/pledges.js';
import { confirmCapturedPayment, verifyPaymentSignature } from './_lib/razorpay.js';

const ORDER_ID = /^(order_[A-Za-z0-9]{8,40}|stub_order_[a-f0-9]{18})$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,40}$/;
const SIGNATURE = /^[a-f0-9]{64}$/;

export async function POST(request: Request): Promise<Response> {
  return guard('verify', async () => {
    const user = await verifyUser(request);
    if (!user) return fail(401, 'Please sign in again to finish your pledge.');

    const body = await readJson(request);
    const orderId = body?.orderId;
    if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return fail(400, 'Invalid request.');

    const order = await getOrder(orderId);
    if (!order || order.uid !== user.uid) return fail(404, 'We could not find that pledge order.');

    const cfg = payConfig();
    let paymentId: string;
    if (order.mode === 'stub') {
      if (cfg.mode !== 'stub') return fail(400, 'That was a test order and cannot be used here.');
      paymentId = `stub_pay_${orderId.slice(-18)}`;
    } else {
      if (cfg.mode !== 'razorpay') return fail(503, 'Payments are paused right now. If money left your account, contact us with your payment ID.');
      const { paymentId: pid, signature } = body as { paymentId?: unknown; signature?: unknown };
      if (typeof pid !== 'string' || !PAYMENT_ID.test(pid) || typeof signature !== 'string' || !SIGNATURE.test(signature)) {
        return fail(400, 'Invalid payment details.');
      }
      if (!verifyPaymentSignature(orderId, pid, signature)) {
        return fail(400, "We couldn't verify that payment. If money left your account, contact us with your payment ID.");
      }
      const confirmed = await confirmCapturedPayment(pid, orderId, chargeOf(order));
      if (!confirmed.ok) {
        console.error(`[pledge/verify] ${orderId}: ${confirmed.reason}`);
        return fail(402, "Your payment hasn't gone through yet. If money left your account, Razorpay returns uncaptured payments automatically, or contact us with your payment ID.");
      }
      paymentId = pid;
    }

    const r = await activate(orderId, paymentId, 'checkout');
    if (!r.ok && r.reason === 'refunded') return fail(409, 'This order was not activated in time, so the payment has been returned to you.');
    if (!r.ok) return fail(409, 'This order was already paid with a different payment. Please contact us with your payment ID.');
    return json(200, { pledgeId: r.pledgeId, status: r.status, duplicate: r.duplicate, mode: order.mode });
  });
}
