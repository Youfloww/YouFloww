/**
 * The only Study Hall code in the main bundle (imported by FeatureHosts): "is there a live hall seat or
 * Study Together group in this tab?". The session itself (Firebase, listeners, tray) is loaded only when
 * `on` is true. A sessionStorage flag survives a reload of the same tab, so the session rejoins by itself;
 * closing the tab drops it (onDisconnect on the server side, sessionStorage on ours).
 */
import { create } from 'zustand';

export interface LiveFlag {
  /** sitting in the hall */
  hall: boolean;
  /** the hall we sat in (tried first when rejoining) */
  room: string;
  /** Study Together group code, '' = none */
  group: string;
}

const KEY = 'together:live';

export function readFlag(): LiveFlag | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Partial<LiveFlag> | null;
    if (!v || (!v.hall && !v.group)) return null;
    return { hall: !!v.hall, room: typeof v.room === 'string' ? v.room : '', group: typeof v.group === 'string' ? v.group : '' };
  } catch {
    return null;
  }
}

export function writeFlag(f: LiveFlag | null) {
  try {
    if (!f || (!f.hall && !f.group)) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* private mode: no auto-rejoin, everything else works */
  }
}

/** `on`: a session exists (or is being restored) in this tab, so the session host should be mounted. */
export const useTogetherLive = create<{ on: boolean }>()(() => ({ on: readFlag() !== null }));
export const setLive = (on: boolean) => useTogetherLive.getState().on !== on && useTogetherLive.setState({ on });
