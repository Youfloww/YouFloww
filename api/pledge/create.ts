/**
 * POST /api/pledge/create  (Authorization: Bearer <Firebase ID token>)
 * body: { amount: 49|99|199|499, goal: Goal, tz: IANA zone, adult: true, terms: TERMS_VERSION }
 *
 * Checks the person, the goal and that they have no active pledge, then opens a Razorpay order
 * (INR, notes: uid + goal). In local STUB mode no order is created at Razorpay and nothing is charged.
 */
import { TERMS_VERSION, isAmount, parseGoal, validTimeZone } from '../../src/features/pledge/rules.js';
import { verifyUser } from './_lib/admin.js';
import { payConfig } from './_lib/env.js';
import { fail, guard, json, readJson } from './_lib/http.js';
import { startOrder } from './_lib/pledges.js';

export async function POST(request: Request): Promise<Response> {
  return guard('create', async () => {
    const cfg = payConfig();
    if (cfg.mode === 'disabled') return fail(503, 'Pledges are paused right now. Nothing was charged.');

    const user = await verifyUser(request);
    if (!user) return fail(401, 'Please sign in to make a pledge.');

    const body = await readJson(request);
    if (!body) return fail(400, 'Invalid request.');
    if (!isAmount(body.amount)) return fail(400, 'Pick one of the pledge amounts: ₹49, ₹99, ₹199 or ₹499.');
    const goal = parseGoal(body.goal);
    if (!goal) return fail(400, 'That goal is outside the allowed range.');
    if (!validTimeZone(body.tz)) return fail(400, 'Unknown time zone.');
    if (body.adult !== true) return fail(400, 'Focus Pledges are only for people aged 18 or over.');
    if (body.terms !== TERMS_VERSION) return fail(409, 'The pledge terms were updated. Please reload the page and read them again.');

    const r = await startOrder(user.uid, body.amount, goal, body.tz);
    if (!r.ok) {
      if (r.reason === 'active') return fail(409, 'You already have an active pledge. One at a time!');
      if (r.reason === 'slow') return fail(429, 'One moment, please try again in a few seconds.');
      return fail(429, 'Too many payment attempts today. Please try again tomorrow.');
    }
    return json(200, {
      orderId: r.orderId,
      amountPaise: r.amountPaise,
      pledgePaise: r.pledgePaise,
      feePaise: r.feePaise,
      mode: r.mode,
      keyId: r.keyId,
      stub: r.mode === 'stub' ? 'TEST MODE: nothing is charged and nothing is refunded.' : undefined,
    });
  });
}
