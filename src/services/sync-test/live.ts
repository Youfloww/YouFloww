/** `npx -y tsx@4 --tsconfig tsconfig.json src/services/sync-test/live.ts`: one session per account across devices, and no minute counted twice. */
import { normalizeUserData, overlapSeconds, recordFocusSession } from '@/data/model';
import { mayWrite, runningElsewhere, shouldYield, type LiveDoc } from '../liveRules';

let failed = 0;
const ok = (c: unknown, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) failed++;
};
const now = Date.now();
const doc = (p: Partial<LiveDoc>): LiveDoc => ({ dev: 'phone', name: 'iPhone', phone: true, status: 'running', at: now - 600_000, endAt: now + 900_000, label: 'Café', emoji: '☕', seen: now, ...p });

ok(runningElsewhere(doc({}), 'mac', now), 'a running session on the phone is seen from the Mac');
ok(!runningElsewhere(doc({}), 'phone', now), 'a device never blocks itself');
ok(!runningElsewhere(doc({ status: 'paused', endAt: null }), 'mac', now), 'a paused session elsewhere does not block');
ok(!runningElsewhere(doc({ endAt: now - 1000 }), 'mac', now), 'a crashed device stops counting once its countdown would have ended');
ok(shouldYield(doc({ at: now - 1000 }), 'mac', { status: 'running', at: now - 600_000 }, now), 'the older session yields to a newer one elsewhere');
ok(!shouldYield(doc({ at: now - 900_000 }), 'mac', { status: 'running', at: now - 600_000 }, now), 'the newer session keeps going');
ok(shouldYield(doc({ at: now - 1000 }), 'mac', { status: 'paused', at: now - 600_000 }, now), 'a paused older session yields too');
ok(!shouldYield(doc({}), 'mac', { status: 'idle', at: null }, now), 'nothing to end when idle');
ok(!mayWrite(doc({}), 'mac', { status: 'idle', at: null }, now), 'idle never overwrites another device');
ok(mayWrite(doc({ dev: 'mac', name: 'Mac' }), 'mac', { status: 'idle', at: null }, now), 'idle clears its own doc');
ok(!mayWrite(doc({}), 'mac', { status: 'paused', at: now - 900_000 }, now), 'a paused session never hides a running one elsewhere');
ok(mayWrite(doc({}), 'mac', { status: 'running', at: now }, now), 'a newer running session takes the doc');
ok(mayWrite(null, 'mac', { status: 'running', at: now }, now), 'first write');

// overlap: two devices logged the same half hour
const d = normalizeUserData({});
const t0 = now - 7200_000;
recordFocusSession(d, { seconds: 1800, completed: true, startedAt: t0 });
recordFocusSession(d, { seconds: 1800, completed: true, startedAt: t0 + 600_000 }); // 20 of its 30 minutes overlap
ok(d.totalFocusSeconds === 1800 + 600, `overlapping minutes count once (${d.totalFocusSeconds}s)`);
recordFocusSession(d, { seconds: 1500, completed: true, startedAt: t0 + 2400_000 - 30_000 }); // 30 s clock skew, back to back
ok(d.totalFocusSeconds === 1800 + 600 + 1500, 'back-to-back sessions with a little clock skew lose nothing');
ok(overlapSeconds(d.sessionLog, t0, 1800) === 600, 'overlapSeconds measures the shared part (its own entry skipped)');
const before = d.totalFocusSeconds;
recordFocusSession(d, { seconds: 900, completed: true, startedAt: t0 + 300_000 });
ok(d.totalFocusSeconds === before, 'a session fully inside logged time adds nothing');
recordFocusSession(d, { seconds: 600, completed: true, startedAt: t0 + 60_000, replay: true });
ok(d.totalFocusSeconds === before + 600, 'replays of sessions recorded elsewhere are kept as they were');
const src = normalizeUserData({});
recordFocusSession(src, { seconds: 600, completed: true, startedAt: t0, src: 'cafe' });
ok(src.sessionLog?.[0].src === 'cafe', 'the session log remembers where a session started');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
