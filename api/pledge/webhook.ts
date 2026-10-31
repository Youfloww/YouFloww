/**
 * POST /api/pledge/webhook  (Razorpay webhook, X-Razorpay-Signature = HMAC_SHA256(raw body, RAZORPAY_WEBHOOK_SECRET))
 *
 * Optional backstop for a browser that closed between paying and /verify. A signed event can only confirm the
 * same facts /verify checks: the order is one of ours, and Razorpay says the payment is captured for its full
 * amount. It also records refund.processed / refund.failed for refunds we created.
 *
 * The Razorpay account is shared with giftasite, so events for giftasite's orders arrive here too: anything
 * that isn't a pledge order is acknowledged and ignored.
 */
import { payConfig } from './_lib/env.js';
import { fail, guard, json } from './_lib/http.js';
import { activate, chargeOf, getOrder, noteRefundEvent } from './_lib/pledges.js';
import { confirmCapturedPayment, verifyWebhookSignature } from './_lib/razorpay.js';

interface Entity {
  id?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
  notes?: Record<string, string> | unknown[];
}

export async function POST(request: Request): Promise<Response> {
  return guard('webhook', async () => {
    const raw = await request.text();
    if (raw.length > 256 * 1024) return fail(413, 'Too large.');
    if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature') ?? '')) return fail(400, 'Bad signature.');

    let event: { event?: string; payload?: { payment?: { entity?: Entity }; refund?: { entity?: Entity } } };
    try {
      event = JSON.parse(raw);
    } catch {
      return fail(400, 'Bad JSON.');
    }

    if ((event.event === 'payment.captured' || event.event === 'order.paid') && payConfig().mode === 'razorpay') {
      const p = event.payload?.payment?.entity;
      if (p?.id && p.order_id && /^order_[A-Za-z0-9]{8,40}$/.test(p.order_id) && /^pay_[A-Za-z0-9]{8,40}$/.test(p.id)) {
        const order = await getOrder(p.order_id);
        if (order && order.mode !== 'stub' && order.status === 'created' && p.amount === chargeOf(order) && p.status === 'captured') {
          const confirmed = await confirmCapturedPayment(p.id, p.order_id, chargeOf(order));
          if (confirmed.ok) await activate(p.order_id, p.id, 'webhook');
          else console.error(`[pledge/webhook] ${p.order_id}: ${confirmed.reason}`);
        }
      }
    }

    if (event.event === 'refund.processed' || event.event === 'refund.failed') {
      const r = event.payload?.refund?.entity;
      const notes = r?.notes && !Array.isArray(r.notes) ? (r.notes as Record<string, string>) : {};
      if (r?.id && notes.app === 'youfloww-pledge' && typeof notes.pledgeId === 'string' && /^order_[A-Za-z0-9]{8,40}$/.test(notes.pledgeId)) {
        await noteRefundEvent(notes.pledgeId, r.id, event.event === 'refund.processed' ? 'processed' : 'failed');
      }
    }

    return json(200, { ok: true });
  });
}
