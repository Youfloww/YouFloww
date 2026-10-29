import { getFeatureData, updateFeatureData } from '@/lib/featureData';
import { useData } from '@/store/data';
import { elapsedAt, useTimer } from '@/store/timer';

/**
 * The cat's own little project while you focus: she knits, reads or writes beside the timer.
 * Its progress rides on your session; a finished session finishes her piece and she keeps it
 * (the collection in her home). Ending early or leaving never destroys anything: what she made
 * so far waits for the next session.
 *
 * Saved under data.catHome (shared with the Cat's Home mode), kept tiny.
 */
export type CraftKind = 'scarf' | 'book' | 'journal';
export const CRAFTS: CraftKind[] = ['scarf', 'book', 'journal'];

export interface Project {
  k: CraftKind;
  /** variant: palette / title index */
  p: number;
  /** progress saved from earlier sessions (0-1) */
  base: number;
  /** the session (its start time) this project is riding, null between sessions */
  at: number | null;
  /** that session's planned length */
  dur: number;
}
export interface Made {
  k: CraftKind;
  p: number;
  /** finished at */
  t: number;
  /** minutes of the session that finished it */
  m: number;
}
export interface CatHomeData {
  project: Project | null;
  made: Made[];
  /** projects started so far (rotates the craft) */
  n: number;
  /** Cat's Home: current room, unlocked rooms, and what stands in which slot of each room */
  room?: string;
  rooms?: string[];
  place?: Record<string, Record<string, string>>;
}
export const HOME_KEY = 'catHome';
export const HOME_EMPTY: CatHomeData = { project: null, made: [], n: 0 };

const read = () => getFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY);
const write = (fn: (d: CatHomeData) => void) =>
  updateFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY, (d) => {
    d.made ??= [];
    d.n ??= 0;
    fn(d);
  });

/* ------------------------------------------------------------------ */
/* Looks and names                                                      */
/* ------------------------------------------------------------------ */
/** scarf palettes: [main, stripe, name] */
export const SCARVES: [string, string, string][] = [
  ['#f4a3b8', '#fff1e8', 'Strawberry'],
  ['#9fd6bd', '#7a5a43', 'Mint chip'],
  ['#a9bdf0', '#fff6dd', 'Blueberry'],
  ['#f5ae62', '#fff1df', 'Pumpkin spice'],
  ['#c7b0ee', '#fff4fb', 'Lavender'],
  ['#f6d56a', '#ffffff', 'Lemon'],
  ['#b88763', '#f5ddc5', 'Hot cocoa'],
  ['#ef8f8f', '#a8d8c0', 'Candy cane'],
  ['#8fc7e8', '#f6a8c0', 'Cotton candy'],
  ['#a7c47f', '#fbe7b0', 'Matcha'],
];
export const BOOKS: [string, string][] = [
  ['Purr and Prejudice', '#e98e86'],
  ['The Great Catsby', '#8fb8e0'],
  ['Moby Dish', '#79b9a4'],
  ['War and Fleece', '#c49cdc'],
  ['Of Mice and Mittens', '#f0b35e'],
  ['A Tail of Two Kitties', '#e6889e'],
  ['Little Whiskers', '#9ccf8f'],
  ['The Catcher in the Rye', '#d9a066'],
  ['Twenty Thousand Naps', '#7fa6d9'],
  ['Anne of Green Catbles', '#93c47d'],
  ['The Hitchhiker’s Guide to the Sofa', '#f2c45a'],
  ['Hairy Potter', '#b98bd6'],
];
export const JOURNALS: [string, string][] = [
  ['Sunbeam notes', '#f7c873'],
  ['Poems about naps', '#b7a3e6'],
  ['Dear diary', '#f2a0b5'],
  ['Dreams of tuna', '#8cc6df'],
  ['Tiny haikus', '#a5d2a0'],
  ['Things I love', '#f29d84'],
  ['Window watching log', '#c9b08f'],
  ['Letters to my human', '#e8a6c9'],
];
const COUNT: Record<CraftKind, number> = { scarf: SCARVES.length, book: BOOKS.length, journal: JOURNALS.length };

export function craftName(k: CraftKind, p: number) {
  if (k === 'scarf') return `${SCARVES[p % SCARVES.length][2]} scarf`;
  if (k === 'book') return `“${BOOKS[p % BOOKS.length][0]}”`;
  return `Journal: ${JOURNALS[p % JOURNALS.length][0]}`;
}
export const CRAFT_VERB: Record<CraftKind, string> = { scarf: 'knitting', book: 'reading', journal: 'writing' };
export const CRAFT_EMOJI: Record<CraftKind, string> = { scarf: '🧣', book: '📖', journal: '📓' };

function newProject(d: CatHomeData): Project {
  const k = CRAFTS[d.n % CRAFTS.length];
  const seen = new Set(d.made.filter((m) => m.k === k).map((m) => m.p));
  const fresh = [...Array(COUNT[k]).keys()].filter((i) => !seen.has(i));
  const pool = fresh.length ? fresh : [...Array(COUNT[k]).keys()];
  d.n += 1;
  return { k, p: pool[Math.floor(Math.random() * pool.length)], base: 0, at: null, dur: 25 * 60_000 };
}

/* ------------------------------------------------------------------ */
/* Riding the timer                                                     */
/* ------------------------------------------------------------------ */
const focusSession = () => {
  const t = useTimer.getState();
  return t.mode === 'focus' && t.status !== 'idle' ? t : null;
};

/** What she's working on (null until her first session) */
export const currentProject = () => read().project;

/** Live progress (0-1) of her project */
export function studyProgress(now = Date.now()) {
  const pr = read().project;
  if (!pr) return 0;
  const t = focusSession();
  if (t && pr.at && t.sessionStartedAt === pr.at) {
    const f = Math.min(1, elapsedAt(t, now) / Math.max(60_000, t.durationMs));
    return pr.base + (1 - pr.base) * f;
  }
  return pr.base;
}

/**
 * The session her project rode has ended (maybe while she wasn't on screen): a finished session
 * finishes the piece, an early end keeps what she did. Idempotent; returns the finished piece.
 */
let settled: { at: number; made: Made | null } | null = null;
export function settleStudy(ended = false): Made | null {
  const pr = read().project;
  // several listeners hear the same session end: each gets the same answer
  if (!pr?.at) return ended && settled && settled.at === useData.getState().data.sessionLog?.at(-1)?.at ? settled.made : null;
  // `ended`: called from session:complete / session:early, which fire before the timer resets
  const t = focusSession();
  if (!ended && t && t.sessionStartedAt === pr.at) return null;
  const e = [...(useData.getState().data.sessionLog ?? [])].reverse().find((x) => x.at === pr.at);
  let made: Made | null = null;
  write((d) => {
    const p = d.project;
    if (!p || p.at !== pr.at) return;
    if (e?.done) {
      made = { k: p.k, p: p.p, t: Date.now(), m: Math.round(e.sec / 60) };
      d.made.push(made);
      if (d.made.length > 300) d.made.splice(0, d.made.length - 300);
      d.project = null;
    } else {
      if (e) p.base = Math.min(0.96, p.base + (1 - p.base) * Math.min(1, (e.sec * 1000) / Math.max(60_000, p.dur)));
      p.at = null;
    }
  });
  settled = { at: pr.at, made };
  return made;
}

/** A focus session is running: her project rides it */
export function beginStudy() {
  settleStudy();
  const t = focusSession();
  if (!t?.sessionStartedAt) return;
  const at = t.sessionStartedAt;
  if (read().project?.at === at) return;
  write((d) => {
    d.project ??= newProject(d);
    d.project.at = at;
    d.project.dur = t.durationMs;
  });
}
