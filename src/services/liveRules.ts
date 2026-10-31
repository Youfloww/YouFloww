/**
 * The rules behind "one focus session per account, across devices" (pure, so they can be tested without Firebase).
 * Each device writes what it runs to users/{uid}/live/session; these decide what a device does with what it reads.
 */

export interface LiveDoc {
  /** the device (one per browser; its tabs share it) */
  dev: string;
  /** "iPhone", "Mac"… */
  name: string;
  phone: boolean;
  /** breaks are written as idle: only focus counts */
  status: 'idle' | 'running' | 'paused';
  /** the session's start (useTimer.sessionStartedAt), which tells sessions apart */
  at: number | null;
  /** when a running countdown ends */
  endAt: number | null;
  label: string;
  emoji: string;
  /** when it was written (this device's clock) */
  seen: number;
}

export interface LocalSession {
  status: 'idle' | 'running' | 'paused';
  at: number | null;
}

/** Another device's focus session that is running right now, if the doc shows one. */
export function runningElsewhere(doc: LiveDoc | null, me: string, now: number): LiveDoc | null {
  if (!doc || doc.dev === me || doc.status !== 'running' || !doc.endAt || !doc.at) return null;
  // a crashed device's doc says "running" until its countdown would have ended; past that it's nothing
  return doc.endAt > now + 10_000 ? doc : null;
}

/** A newer session started on another device: this device ends its own (logged), so time never counts twice. */
export function shouldYield(doc: LiveDoc | null, me: string, local: LocalSession, now: number): boolean {
  const other = runningElsewhere(doc, me, now);
  return !!other && local.status !== 'idle' && !!local.at && other.at! > local.at;
}

/** May this device write its own state over the doc? Never over another device's newer running session. */
export function mayWrite(doc: LiveDoc | null, me: string, local: LocalSession, now: number): boolean {
  if (local.status === 'idle') return !!doc && doc.dev === me && doc.status !== 'idle';
  const other = runningElsewhere(doc, me, now);
  return !other || (local.status === 'running' && !!local.at && local.at > other.at!);
}

/** "your iPhone", or "your other Mac" when both are Macs. */
export function deviceLabel(doc: Pick<LiveDoc, 'name'>, myName: string) {
  return doc.name === myName ? `your other ${doc.name}` : `your ${doc.name}`;
}

export function detectDevice(ua: string, touch: number): { name: string; phone: boolean } {
  if (/iPhone/.test(ua)) return { name: 'iPhone', phone: true };
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return { name: 'iPad', phone: true };
  if (/Android/.test(ua)) return { name: /Mobile/.test(ua) ? 'phone' : 'tablet', phone: true };
  if (/CrOS/.test(ua)) return { name: 'Chromebook', phone: false };
  if (/Mac/.test(ua)) return { name: 'Mac', phone: false };
  if (/Windows/.test(ua)) return { name: 'PC', phone: false };
  return { name: 'computer', phone: false };
}
