/**
 * One focus session per account, across devices. Each device writes what it runs to users/{uid}/live/session, only
 * when that changes (start, pause, end: no heartbeat). Starting while another device focuses asks to move the session
 * (see `start` in timer/engine), and a device that sees a newer session elsewhere ends its own, minutes logged.
 */
import { useTimer } from '@/store/timer';
import { toast, useUI } from '@/store/ui';
import { formatClock } from '@/lib/time';
import { endEarly, setElsewhere } from '@/features/timer/engine';
import { detectDevice, deviceLabel, mayWrite, runningElsewhere, shouldYield, type LiveDoc, type LocalSession } from './liveRules';
import type { FB } from './firebase';

const DEV = (() => {
  const fresh = () => Math.random().toString(36).slice(2, 10);
  try {
    let d = localStorage.getItem('floww:device');
    if (!d) localStorage.setItem('floww:device', (d = fresh()));
    return d;
  } catch {
    return fresh();
  }
})();
const ME = detectDevice(navigator.userAgent, navigator.maxTouchPoints || 0);

let fbRef: FB | null = null;
let uid: string | null = null;
let doc: LiveDoc | null = null;
let unsubDoc: (() => void) | null = null;
let unsubTimer: (() => void) | null = null;
let lastKey = '';
let told = 0;
/** one tab per device writes and acts (others only read), so a session is never ended, and logged, twice */
let leader = false;
let lock: AbortController | null = null;

function local(): LocalSession & { endAt: number | null } {
  const t = useTimer.getState();
  const status = t.mode === 'focus' ? t.status : 'idle';
  return { status, at: status === 'idle' ? null : t.sessionStartedAt, endAt: status === 'running' ? t.endAt : null };
}

function write() {
  if (!fbRef || !uid || !leader) return;
  const l = local();
  const key = `${l.status}|${l.at}|${l.endAt}`;
  if (key === lastKey || !mayWrite(doc, DEV, l, Date.now())) return;
  lastKey = key;
  const src = useTimer.getState().source;
  const next: LiveDoc = { dev: DEV, name: ME.name, phone: ME.phone, status: l.status, at: l.at, endAt: l.endAt, label: src?.label ?? 'Focus', emoji: src?.emoji ?? '🎯', seen: Date.now() };
  doc = next;
  const { fsMod, db } = fbRef;
  void fsMod.setDoc(fsMod.doc(db, 'users', uid, 'live', 'session'), next).catch(() => (lastKey = ''));
}

function onRemote(d: LiveDoc | null) {
  doc = d;
  const now = Date.now();
  const l = local();
  if (!leader) return;
  if (shouldYield(d, DEV, l, now)) {
    // a newer session started on another device: end this one here (its minutes are logged), never both
    const where = deviceLabel(d!, ME.name);
    if (useUI.getState().confirm) useUI.getState().set({ confirm: null });
    endEarly();
    toast({ emoji: d!.phone ? '📱' : '💻', title: `Your session moved to ${where}`, body: 'Time here was logged; it carries on there.', ms: 6000 });
    return;
  }
  const other = runningElsewhere(d, DEV, now);
  if (other && l.status === 'idle' && told !== other.at) {
    told = other.at!;
    toast({ emoji: other.phone ? '📱' : '💻', title: `Focusing on ${deviceLabel(other, ME.name)}`, body: `${other.emoji} ${other.label} · ${formatClock(other.endAt! - now)} left`, ms: 5000 });
  }
  // this device runs a newer session than the doc shows (it was offline, or just signed in): say so
  write();
}

export function startLive(fb: FB, userId: string) {
  stopLive();
  fbRef = fb;
  uid = userId;
  lastKey = '';
  const { fsMod, db } = fb;
  unsubDoc = fsMod.onSnapshot(
    fsMod.doc(db, 'users', userId, 'live', 'session'),
    (snap) => onRemote(snap.exists() ? (snap.data() as LiveDoc) : null),
    () => {},
  );
  unsubTimer = useTimer.subscribe(write);
  // the first tab of this browser leads; when it closes, the next one takes over
  const ctl = (lock = new AbortController());
  const take = () => {
    if (ctl.signal.aborted) return;
    leader = true;
    onRemote(doc);
  };
  if (navigator.locks)
    void navigator.locks
      .request('floww:live', { signal: ctl.signal }, () => {
        take();
        return new Promise<void>((res) => ctl.signal.addEventListener('abort', () => res()));
      })
      .catch(() => {});
  else take();
}

export function stopLive() {
  lock?.abort();
  lock = null;
  leader = false;
  unsubDoc?.();
  unsubTimer?.();
  unsubDoc = unsubTimer = null;
  fbRef = null;
  uid = null;
  doc = null;
}

setElsewhere(() => {
  const o = uid ? runningElsewhere(doc, DEV, Date.now()) : null;
  return o ? { device: deviceLabel(o, ME.name), phone: o.phone, label: o.label, emoji: o.emoji, leftMs: o.endAt! - Date.now() } : null;
});
