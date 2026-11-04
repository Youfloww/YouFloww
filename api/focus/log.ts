/**
 * POST /api/focus/log  (Authorization: Bearer <Firebase ID token>; anonymous accounts are refused)
 * body: { sessions: [{ sec: integer 30..21600, done: boolean }] (1..20, oldest first), tz: IANA zone, name: string }
 *
 * The browser reports finished focus sessions; the server credits them against real elapsed time on its own
 * clock (src/features/pledge/ledger.ts) into focusLedger/{uid}, and rebuilds the public leaderboard entry.
 *
 * 200 { credited, totalSec, todayMin, streak, day } · 400 invalid body (drop the batch) · 401 bad or missing token
 * (refresh it and retry) · 429 too soon (retry later) · 500/503 server trouble (retry later)
 */
import { parseFocusBatch } from '../../src/features/pledge/ledger.js';
import { verifyUser } from '../pledge/_lib/admin.js';
import { fail, guard, json, readJson } from '../pledge/_lib/http.js';
import { logFocus } from './_lib/focus.js';

export async function POST(request: Request): Promise<Response> {
  return guard(
    'log',
    async () => {
      const user = await verifyUser(request);
      if (!user) return fail(401, 'Please sign in again.');

      const body = await readJson(request);
      const batch = body && parseFocusBatch(body);
      if (!batch) return fail(400, 'Invalid focus report.');

      const r = await logFocus(user.uid, batch);
      if (!r.ok) {
        const res = fail(429, 'One moment, please try again in a few seconds.');
        res.headers.set('Retry-After', '3');
        return res;
      }
      return json(200, { credited: r.credited, totalSec: r.totalSec, todayMin: r.todayMin, streak: r.streak, day: r.day });
    },
    'focus',
  );
}
