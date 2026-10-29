/**
 * GET|POST /api/pledge/settle  (Authorization: Bearer <CRON_SECRET>)
 *
 * Run once a day by Vercel Cron (vercel.json "crons"; Vercel sends the CRON_SECRET header itself).
 * Settles every pledge past its deadline (+1 h grace for syncing): met -> full refund, missed -> forfeited
 * (donated). Retries refunds that are still pending. Safe to run any number of times.
 */
import { cronSecret } from './_lib/env.js';
import { fail, guard, json } from './_lib/http.js';
import { settleDue } from './_lib/pledges.js';
import { safeEqual } from './_lib/razorpay.js';

async function run(request: Request): Promise<Response> {
  return guard('settle', async () => {
    const secret = cronSecret();
    if (secret.length < 16) return fail(503, 'Settlement is not configured.');
    if (!safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return fail(401, 'Unauthorized.');
    const summary = await settleDue();
    console.log(`[pledge/settle] ${JSON.stringify(summary)}`);
    return json(200, summary);
  });
}

export const GET = run;
export const POST = run;
