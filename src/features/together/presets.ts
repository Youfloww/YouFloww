/** Fixed hall messages (the public hall has no free text), the light swear mask and the local mute list. */

export const SAYS = {
  gl: { emoji: '🍀', text: 'Good luck! 🍀' },
  yg: { emoji: '💪', text: "You've got this 💪" },
  nf: { emoji: '🔥', text: 'Nice focus! 🔥' },
  bb: { emoji: '☕', text: 'Break buddy? ☕' },
} as const;
export type SayKind = keyof typeof SAYS;
export const SAY_KINDS = Object.keys(SAYS) as SayKind[];
export const isSayKind = (k: unknown): k is SayKind => typeof k === 'string' && k in SAYS;

/** the request card text */
export const ASK_TEXT = 'Study together? 📚';
/** ms a "study together?" request stays open (the rules accept answers for 2 minutes) */
export const ASK_TTL = 115_000;
/** per pair cooldowns, mirrored from database.rules.json */
export const SAY_GAP = 10_000;
export const ASK_GAP = 120_000;
export const ASK_ANY_GAP = 20_000;
export const CHAT_GAP = 1_500;
export const CHAT_MAX = 200;

/* ------------------------------------------------------------------ */
/* swear mask (light, client side only)                                */
/* ------------------------------------------------------------------ */
const WORDS = [
  'fuck', 'fucking', 'fucker', 'fck', 'fuk', 'shit', 'bitch', 'bastard', 'asshole', 'arsehole', 'dick', 'dickhead', 'cunt',
  'pussy', 'slut', 'whore', 'motherfucker', 'wanker', 'twat', 'retard', 'nigger', 'nigga', 'faggot', 'fag',
  'chutiya', 'chutiye', 'madarchod', 'behenchod', 'bhenchod', 'bc', 'mc', 'bsdk', 'bhosdike', 'bhosdi', 'gandu', 'randi', 'lund', 'lauda', 'laude',
];
const RE = new RegExp(`(^|[^a-z])(${WORDS.join('|')})(?=$|[^a-z])`, 'gi');
export function mask(s: string): string {
  return s.replace(RE, (_m, pre: string, w: string) => pre + w[0] + '•'.repeat(Math.max(2, w.length - 1)));
}

/* ------------------------------------------------------------------ */
/* local mute list                                                     */
/* ------------------------------------------------------------------ */
const MUTE_KEY = 'together:muted';
let muted: Set<string> | null = null;
const load = () => {
  if (muted) return muted;
  try {
    muted = new Set((JSON.parse(localStorage.getItem(MUTE_KEY) || '[]') as unknown[]).filter((x): x is string => typeof x === 'string').slice(-200));
  } catch {
    muted = new Set();
  }
  return muted;
};
export const isMuted = (uid: string) => load().has(uid);
export function setMuted(uid: string, on: boolean) {
  const m = load();
  if (on) m.add(uid);
  else m.delete(uid);
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify([...m]));
  } catch {
    /* ignore */
  }
}
