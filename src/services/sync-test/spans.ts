/** Sessions that paused: days, streaks and overlaps follow the stretches they really ran. `npx tsx src/services/sync-test/spans.ts` */
import { normalizeUserData, recordFocusSession, rollover, layOut, deriveStats as derive, type RecordSessionInput } from '@/data/model';
import type { UserData } from '@/data/types';
import { dateKey } from '@/lib/time';

let failed = 0;
const ok = (c: unknown, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) failed++;
};
const rec = (d: UserData, i: RecordSessionInput) => {
  rollover(d);
  return recordFocusSession(d, i);
};
const at = (daysAgo: number, h: number, m = 0) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - daysAgo, h, m).getTime();
};
const MIN = 60_000;

// 1. one stretch (no pause) gives exactly what no stretches gave, also over midnight
for (const [t0, sec] of [[at(2, 10), 1500], [at(2, 23, 50), 1500], [at(1, 7, 31), 3 * 3600 + 17]] as const) {
  const a = normalizeUserData({});
  const b = normalizeUserData({});
  rec(a, { seconds: sec, completed: true, startedAt: t0 });
  rec(b, { seconds: sec, completed: true, startedAt: t0, spans: [[t0, t0 + sec * 1000]] });
  a.updatedAt = b.updatedAt = a.createdAt = b.createdAt = 0;
  ok(JSON.stringify(a) === JSON.stringify(b), `one stretch = old behaviour (${new Date(t0).toTimeString().slice(0, 5)}, ${sec}s)`);
}

// 2. paused late one night, resumed the next morning: both days get their own minutes, the streak grows twice
{
  const d = normalizeUserData({ streakCount: 3, bestStreak: 3, lastStreakDate: dateKey(new Date(at(3, 12))) });
  const s1 = at(2, 23);
  const s2 = at(1, 9);
  const r = rec(d, { seconds: 1500, completed: true, startedAt: s1, spans: [[s1, s1 + 10 * MIN], [s2, s2 + 15 * MIN]] });
  const k1 = dateKey(new Date(s1));
  const k2 = dateKey(new Date(s2));
  ok(d.dailyFocusSeconds![k1] === 600 && d.dailyFocusSeconds![k2] === 900, `paused overnight: 10 min on the first day, 15 on the next (${d.dailyFocusSeconds![k1]}, ${d.dailyFocusSeconds![k2]})`);
  ok(d.streakCount === 5 && d.lastStreakDate === k2 && r.streak === 'inc', `paused overnight: streak 3 → 5, last day = resume day (${d.streakCount}, ${d.lastStreakDate})`);
  ok(d.sessionLog!.at(-1)!.at === s1 && d.sessionLog!.at(-1)!.sec === 1500, 'paused overnight: logged once, under its start time, 25 min');
  ok(d.hourlyFocusSeconds![23] === 600 && d.hourlyFocusSeconds![9] === 900, 'paused overnight: hours follow the stretches');
  ok(d.totalFocusSeconds === 1500 && d.weeklySessions[k1] === 1 && !d.weeklySessions[k2], 'paused overnight: one session, on its start day');
}

// 3. another device focused during the pause: nothing is dropped as "overlap"
{
  const d = normalizeUserData({});
  const b0 = at(1, 10, 15);
  rec(d, { seconds: 1500, completed: true, startedAt: b0 }); // the phone, 10:15–10:40
  const a0 = at(1, 10);
  rec(d, { seconds: 1500, completed: true, startedAt: a0, spans: [[a0, a0 + 10 * MIN], [at(1, 11), at(1, 11, 15)]] });
  ok(d.totalFocusSeconds === 3000, `focus paused 10:10–11:00 while the phone ran 10:15–10:40: all 50 min kept (${d.totalFocusSeconds / 60})`);
  const e = normalizeUserData({});
  rec(e, { seconds: 1500, completed: true, startedAt: b0 });
  rec(e, { seconds: 1500, completed: true, startedAt: a0, spans: [[a0, a0 + 25 * MIN]] });
  ok(e.totalFocusSeconds === 1500 + 900, `two devices really at once still never count twice (${e.totalFocusSeconds / 60} min)`);
}

// 4. stretches longer than the logged time are cut from the end; missing early stretches sit at the start
{
  const t0 = at(1, 14);
  const cut = layOut([[t0, t0 + 1600_000]], t0, 1505);
  ok(cut.length === 1 && cut[0][0] === t0 && cut[0][1] === 1505, 'a countdown noticed late counts its own length, from the start');
  const late = layOut([[t0 + 3600_000, t0 + 3600_000 + 900_000]], t0, 1500);
  ok(late.length === 2 && late[0][0] === t0 && late[0][1] === 600 && late[1][1] === 900, 'a pause from before this update: its unknown first part sits at the session start');
  ok(JSON.stringify(layOut(undefined, t0, 60)) === JSON.stringify([[t0, 60]]) && JSON.stringify(layOut([[5, 1]] as [number, number][], t0, 60)) === JSON.stringify([[t0, 60]]), 'no or broken stretches: one from the start');
  const sum = layOut([[t0, t0 + 400], [t0 + 1000, t0 + 1400], [t0 + 2000, t0 + 2400]], t0, 1);
  ok(sum.reduce((a, x) => a + x[1], 0) === 1, 'rounding never adds or loses a second');
}

// 5. streaks across a reload: loading the app no longer clears a streak a late session can still save
{
  const k = (n: number) => dateKey(new Date(at(n, 12)));
  const d = normalizeUserData(JSON.parse(JSON.stringify({ streakCount: 6, bestStreak: 6, lastStreakDate: k(2) })));
  ok(derive(d).streak === 0 && d.streakCount === 6, 'a streak last kept two days ago shows 0 but is still stored');
  const s0 = at(1, 23, 50); // started yesterday 23:50, finished today 00:15, app reloaded in between
  const r = rec(d, { seconds: 1500, completed: true, startedAt: s0 });
  ok(d.streakCount === 8 && d.lastStreakDate === k(0) && r.streak === 'inc', `over midnight after a reload: 6 → 8 (${d.streakCount})`);
  ok(derive(d).streak === 8 && d.bestStreak === 8, 'shown 8, best 8');
  const e = normalizeUserData({ streakCount: 6, bestStreak: 6, lastStreakDate: k(3) });
  const r2 = rec(e, { seconds: 1500, completed: true, startedAt: at(0, 9) });
  ok(e.streakCount === 1 && e.bestStreak === 6 && r2.streak === 'inc', 'a really broken streak restarts at 1, best kept, still a +1');
  const r3 = rec(e, { seconds: 1500, completed: true, startedAt: at(0, 11) });
  ok(e.streakCount === 1 && r3.streak === 'none', 'a second session the same day changes nothing');
}

console.log(failed ? `${failed} failed` : 'all spans tests passed');
process.exit(failed ? 1 : 0);
