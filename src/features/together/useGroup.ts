import { useCallback, useEffect, useRef, useState } from 'react';
import { bus } from '@/lib/bus';
import { toast } from '@/store/ui';
import { earn } from '../economy/wallet';
import { updateFeatureData } from '@/lib/featureData';
import { requestFocusFor } from '../timer/engine';
import { hallSound } from './sound';
import { openGroup, randomCode, type Conn, type Group, type GroupCtl, type Member } from './rt';
import { EMPTY_DATA, type TogetherData } from './data';

export type GroupPhase = 'none' | 'joining' | 'lobby' | 'running' | 'bloom' | 'rest' | 'closed';

export interface Session {
  group: Group | null;
  phase: GroupPhase;
  /** 0..1 */
  growth: number;
  wilt: number;
  /** ms left in the shared timer */
  remaining: number;
  me: Member | undefined;
  /** members who stepped away / ended early (for the gentle copy) */
  away: Member[];
  out: Member[];
  bonus: number;
  error: string | null;
  create: (plant: Group['plant'], dur: number) => Promise<void>;
  join: (code: string) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
}

export const teamBonus = (n: number) => Math.min(30, 8 + 4 * Math.max(0, n - 1));

/** One group session at a time. Lives only while the Study Hall is mounted. */
export function useGroup(conn: Conn | null, profile: { name: string; animal: number }, now: number, onCode: (code: string) => void): Session {
  const [group, setGroup] = useState<Group | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<GroupCtl | null>(null);
  const prof = useRef(profile);
  prof.current = profile;
  const offs = useRef<(() => void)[]>([]);
  const rewarded = useRef<string>('');
  const timerFor = useRef<string>('');
  const groupRef = useRef<Group | null>(null);
  groupRef.current = group;

  const stop = useCallback(() => {
    offs.current.forEach((o) => o());
    offs.current = [];
    ctl.current = null;
    setJoined(null);
    setGroup(null);
  }, []);

  const attach = useCallback(
    async (code: string, create: { plant: Group['plant']; dur: number } | null) => {
      if (!conn || busy) return;
      setBusy(true);
      setError(null);
      try {
        const r = await openGroup(conn, code, prof.current, create, (g) => {
          setGroup(g);
          if (!g) setError('closed');
        });
        if (typeof r === 'string') {
          setError(r === 'missing' ? 'We could not find that code. Check the letters?' : r === 'started' ? 'That session already started. Ask for a new code.' : 'That group is full (12 friends).');
          return;
        }
        ctl.current = r;
        setJoined(code);
        onCode(code);
      } catch {
        setError('Could not reach the hall. Try again in a moment.');
      } finally {
        setBusy(false);
      }
    },
    [conn, busy, onCode],
  );

  const uid = conn?.uid;
  const me = group?.members.find((m) => m.uid === uid);
  const dur = (group?.dur ?? 25) * 60_000;
  const serverNow = now + (conn?.offset() ?? 0);
  const elapsed = group && group.st !== 'lobby' && group.at ? Math.max(0, serverNow - group.at) : 0;
  const remaining = Math.max(0, dur - elapsed);
  const away = group?.members.filter((m) => m.m === 'away' || m.m === 'left') ?? [];
  const out = group?.members.filter((m) => m.m === 'out') ?? [];

  let phase: GroupPhase = 'none';
  if (joined && !group) phase = error === 'closed' ? 'closed' : 'joining';
  else if (group) phase = group.st === 'lobby' ? 'lobby' : group.st === 'running' ? 'running' : group.res === 'bloom' ? 'bloom' : group.res === 'rest' ? 'rest' : 'running';

  const finished = phase === 'bloom' || phase === 'rest';
  const growth = finished ? 1 : phase === 'running' ? Math.min(0.98, elapsed / dur) : 0.02;
  const wilt = phase === 'bloom' ? 0 : Math.min(0.95, (out.length ? 0.5 : 0) + (away.length && !finished ? 0.4 : 0));

  // everyone starts their own focus timer when the shared one starts, so seats, ring and fish coins all just work
  useEffect(() => {
    if (!group || group.st !== 'running' || !group.at || !me || me.m === 'out') return;
    if (timerFor.current === group.code) return;
    timerFor.current = group.code;
    const minsLeft = Math.max(1, Math.ceil((group.dur * 60_000 - (Date.now() + (conn?.offset() ?? 0) - group.at)) / 60_000));
    requestFocusFor(minsLeft, 'Focus together', undefined, '🫶');
    ctl.current?.setMine('in');
  }, [group, me, conn]);

  // a member's tab leaves / comes back, or they end their session early
  useEffect(() => {
    if (phase !== 'running') return;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const offA = bus.on('tab:away', () => {
      clearTimeout(grace);
      grace = setTimeout(() => {
        if (groupRef.current?.members.find((m) => m.uid === uid)?.m === 'in') ctl.current?.setMine('away');
      }, 4000);
    });
    const offB = bus.on('tab:back', () => {
      clearTimeout(grace);
      const cur = groupRef.current?.members.find((m) => m.uid === uid)?.m;
      if (cur === 'away' || cur === 'left') ctl.current?.setMine('in');
    });
    const offC = bus.on('session:early', () => {
      const cur = groupRef.current?.members.find((m) => m.uid === uid)?.m;
      if (cur && cur !== 'out') {
        ctl.current?.setMine('out');
        toast({ emoji: '💛', title: 'You stepped out of the group', body: 'No worries. Your friends can still finish; the plant will rest.' });
      }
    });
    return () => {
      clearTimeout(grace);
      offA();
      offB();
      offC();
    };
  }, [phase, uid]);

  // back from a dropped connection: you are "left" until you return
  useEffect(() => {
    if (phase === 'running' && me?.m === 'left' && !document.hidden) ctl.current?.setMine('in');
  }, [phase, me?.m]);

  const retry = remaining <= 0 ? Math.floor(now / 5000) : 0;
  // time is up: the first client to notice settles the result for everybody
  useEffect(() => {
    if (!group || group.st !== 'running' || !group.at || remaining > 0) return;
    const left = group.members.some((m) => m.m === 'out' || m.m === 'left');
    ctl.current?.finish(left ? 'rest' : 'bloom');
  }, [group, remaining, retry]);

  // rewards, once per session
  useEffect(() => {
    if (!group || group.st !== 'done' || !group.res || !me) return;
    const key = `${group.code}-${group.at}`;
    if (rewarded.current === key) return;
    rewarded.current = key;
    const bonus = me.m !== 'out' && group.res === 'bloom' ? teamBonus(group.members.length) : 0;
    updateFeatureData<TogetherData>('together', EMPTY_DATA, (d) => {
      if (d.history.some((h) => h.key === key)) return;
      d.history.unshift({ key, at: group.at, dur: group.dur, n: group.members.length, res: group.res!, plant: group.plant });
      d.history.length = Math.min(d.history.length, 30);
      if (group.res === 'bloom' && me.m !== 'out') d.blooms += 1;
    });
    if (bonus) {
      earn(bonus, 'Team bloom');
      bus.emit('confetti', { big: true });
      hallSound('bloom');
      bus.emit('mascot:say', { text: 'Team bloom! You all did it 🌸', mood: 'love', ms: 4500 });
    } else hallSound('sad');
  }, [group, me]);

  useEffect(() => () => stop(), [stop]);

  return {
    group,
    phase,
    growth,
    wilt,
    remaining,
    me,
    away,
    out,
    bonus: teamBonus(group?.members.length ?? 1),
    error: error === 'closed' ? null : error,
    create: async (plant, d) => {
      stop();
      await attach(randomCode(), { plant, dur: d });
    },
    join: async (code) => {
      stop();
      await attach(code, null);
    },
    start: async () => {
      const ok = await ctl.current?.start();
      if (!ok) setError('Only the host can start, and only from the lobby.');
    },
    leave: async () => {
      const c = ctl.current;
      stop();
      await c?.leave();
    },
  };
}
