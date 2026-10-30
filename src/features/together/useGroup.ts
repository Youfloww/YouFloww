/** React glue for the module-level session (session.ts): a clock and the Study Together view of the store. */
import { useEffect, useState } from 'react';
import { againGroup, createGroup, groupView, joinGroup, leaveGroup, serverNow, startGroup, useSession, viewing, type GroupPhase } from './session';
import type { Group, Member } from './rt';

export type { GroupPhase };

/** Date.now() that ticks every `ms` while the tab is visible */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => !document.hidden && setNow(Date.now()), ms);
    const vis = () => !document.hidden && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms]);
  return now;
}
/** server time, ticking */
export function useServerNow(ms = 1000) {
  const now = useNow(ms);
  return now + (serverNow() - Date.now());
}

/** keeps the chat / hall inbox marked as read while the calling view is on screen */
export function useViewing(kind: 'chat' | 'hall', on = true) {
  useEffect(() => (on ? viewing(kind) : undefined), [kind, on]);
}

export interface Session {
  group: Group | null;
  phase: GroupPhase;
  growth: number;
  wilt: number;
  remaining: number;
  me: Member | undefined;
  away: Member[];
  out: Member[];
  bonus: number;
  error: string | null;
  uid: string;
  create: (plant: Group['plant'], dur: number) => Promise<void>;
  join: (code: string) => Promise<void>;
  start: () => Promise<void>;
  again: () => Promise<void>;
  leave: () => Promise<void>;
}

export function useGroupSession(): Session {
  const now = useServerNow(1000);
  const s = useSession();
  const v = groupView(s, now);
  return {
    ...v,
    error: s.groupErr,
    uid: s.uid,
    create: async (plant, dur) => void (await createGroup(plant, dur)),
    join: async (code) => void (await joinGroup(code)),
    start: startGroup,
    again: async () => void (await againGroup()),
    leave: leaveGroup,
  };
}
