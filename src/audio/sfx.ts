import { useData } from '@/store/data';
import { pick } from '@/lib/utils';
import { audioCtx } from './context';

export type Sfx =
  | 'start' | 'complete' | 'early' | 'task' | 'subtask' | 'taskAdd' | 'pop' | 'streak' | 'goal' | 'tick' | 'break'
  | 'achievement' | 'pause' | 'resume' | 'skip' | 'nudge' | 'park' | 'roll';

/** Meme mode: a pool per moment. Files live in /sounds/fx (v2 classics) and /sounds/memes. */
const MEMES: Partial<Record<Sfx, string[]>> = {
  start: ['fx/start-sound1', 'fx/start-sound2', 'fx/start-sound3', 'fx/start-sound4', 'memes/start-321go', 'memes/start-avengers', 'memes/start-duel', 'memes/start-gameboy', 'memes/start-herewego', 'memes/start-leeroy', 'memes/start-letsgo', 'memes/start-maza', 'memes/start-mission', 'memes/start-pikachu', 'memes/start-powerrangers', 'memes/start-roundone', 'memes/start-rumble', 'memes/start-showtime', 'memes/start-streetfighter', 'memes/start-yessir'],
  pause: ['memes/pause-awkward', 'memes/pause-awkward2', 'memes/pause-baatkuch', 'memes/pause-criminalscum', 'memes/pause-holdup', 'memes/pause-mario', 'memes/pause-mario64', 'memes/pause-nani', 'memes/pause-notsofast', 'memes/pause-nowait', 'memes/pause-objection', 'memes/pause-recordscratch', 'memes/pause-rukozara', 'memes/pause-shallnotpass', 'memes/pause-stopit', 'memes/pause-whistle', 'memes/pause-whoareyou', 'memes/pause-woahsonic', 'memes/pause-xpshutdown', 'memes/pause-zawarudo'],
  resume: ['memes/resume-1up', 'memes/resume-backtowork', 'memes/resume-believeit', 'memes/resume-bringiton', 'memes/resume-continue', 'memes/resume-eyeoftiger', 'memes/resume-hellothere', 'memes/resume-herewegoagain', 'memes/resume-letsago', 'memes/resume-letsgo', 'memes/resume-luigi', 'memes/resume-powerup', 'memes/resume-ps1', 'memes/resume-roundtwo', 'memes/resume-siryessir', 'memes/resume-timeresume', 'memes/resume-xbox', 'memes/resume-xpstartup', 'memes/resume-yeahbaby', 'memes/resume-yeehaw'],
  complete: ['fx/good-meme1', 'fx/good-meme2', 'fx/good-meme3', 'fx/good-meme4', 'memes/done-airhorn', 'memes/done-animewow', 'memes/done-excellent', 'memes/done-ffvictory', 'memes/done-flawless', 'memes/done-itsworking', 'memes/done-kidsyay', 'memes/done-omgwow', 'memes/done-respect', 'memes/done-sheesh', 'memes/done-stageclear', 'memes/done-victory', 'memes/done-wahkyascene', 'memes/done-wedidit', 'memes/done-wow', 'memes/done-yeahboi'],
  streak: ['memes/streak-dominating', 'memes/streak-godlike', 'memes/streak-killingspree', 'memes/streak-monsterkill', 'memes/streak-onfire', 'memes/streak-rampage', 'memes/streak-unstoppable', 'memes/streak-wickedsick'],
  goal: ['memes/goal-highground', 'memes/goal-legendary', 'memes/goal-ohyeah', 'memes/goal-over9000', 'memes/done-victory', 'memes/done-ffvictory'],
  early: ['fx/bad-meme1', 'fx/bad-meme2', 'fx/bad-meme3', 'fx/bad-meme4', 'memes/quit-baskarbhai', 'memes/quit-bruh', 'memes/quit-coffin', 'memes/quit-emotional', 'memes/quit-gameover', 'memes/quit-kyakarraha', 'memes/quit-missionfailed', 'memes/quit-moyemoye', 'memes/quit-nooo', 'memes/quit-robertweide', 'memes/quit-sadviolin', 'memes/quit-tobecontinued', 'memes/quit-trombone', 'memes/quit-wasted', 'memes/quit-xperror', 'memes/quit-youdied'],
  break: ['memes/wake-alarm', 'memes/wake-bugle', 'memes/wake-freeman', 'memes/wake-getbacktowork', 'memes/wake-patapim', 'memes/wake-reality', 'memes/wake-rooster', 'memes/wake-timetostop', 'memes/wake-vietnam', 'memes/wake-wakeupmeme', 'memes/wake-wakeywakey'],
  task: ['memes/task-amongus', 'memes/task-angrybirds', 'memes/task-anotherone', 'memes/task-coin', 'memes/task-correct', 'memes/task-easypeasy', 'memes/task-greatsuccess', 'memes/task-headshot', 'memes/task-hitmarker', 'memes/task-itemget', 'memes/task-kaching', 'memes/task-mehnat', 'memes/task-metalslug', 'memes/task-noice', 'memes/task-pokemon', 'memes/task-shabash', 'memes/task-tooeasy', 'memes/task-verynice', 'memes/task-vineboom', 'memes/task-yatta'],
  subtask: ['memes/task-coin', 'memes/task-hitmarker', 'memes/task-kaching', 'memes/task-correct', 'memes/task-itemget', 'memes/subtask-ding', 'memes/subtask-pickup'],
  taskAdd: ['memes/add-challenge', 'memes/add-jarvis', 'memes/add-roger', 'memes/add-saynomore', 'memes/add-understood', 'memes/add-vader', 'memes/start-yessir'],
  achievement: ['memes/badge-hallelujah', 'memes/badge-levelup', 'memes/badge-ps3', 'memes/badge-ps4', 'memes/badge-secret', 'memes/badge-xbox', 'memes/badge-xboxrare', 'memes/done-victory'],
  skip: ['memes/skip-gottagofast', 'memes/skip-nobodygottime', 'memes/skip-nope', 'memes/quit-bruh'],
  park: ['memes/park-hastalavista', 'memes/park-illbeback', 'memes/park-noted'],
  roll: ['memes/roll-drum', 'memes/roll-snare'],
};

const fx = (name: string) => `/sounds/${name}.mp3`;

/** Random pick that never repeats the previous one for the same moment. */
const lastPick: Partial<Record<Sfx, string>> = {};
function pickFresh(kind: Sfx) {
  const pool = MEMES[kind]!;
  const options = pool.length > 1 ? pool.filter((x) => x !== lastPick[kind]) : pool;
  return (lastPick[kind] = pick(options));
}

function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; glideTo?: number; pan?: number } = {}) {
  const c = audioCtx();
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur * 0.8);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = g;
  if (opts.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = opts.pan;
    g.connect(p);
    node = p;
  }
  osc.connect(g);
  node.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** A sparkly bell: fundamental + soft harmonics. */
function bell(freq: number, at: number, gain = 0.12, dur = 0.9) {
  tone(freq, at, dur, { type: 'sine', gain });
  tone(freq * 2, at, dur * 0.6, { type: 'sine', gain: gain * 0.35 });
  tone(freq * 3.01, at, dur * 0.35, { type: 'triangle', gain: gain * 0.12 });
}

const synth: Record<Sfx, () => void> = {
  start: () => {
    tone(392, 0, 0.18, { type: 'sine', gain: 0.16, glideTo: 784 });
    bell(1046.5, 0.12, 0.09, 0.6);
  },
  complete: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, i * 0.09, 0.11, 1.1));
  },
  early: () => {
    tone(440, 0, 0.25, { type: 'triangle', gain: 0.12, glideTo: 330 });
    tone(330, 0.22, 0.4, { type: 'triangle', gain: 0.1, glideTo: 220 });
  },
  task: () => {
    bell(1318.5, 0, 0.09, 0.5);
    bell(1760, 0.08, 0.08, 0.7);
  },
  pop: () => tone(620, 0, 0.09, { type: 'sine', gain: 0.08, glideTo: 980 }),
  pause: () => tone(700, 0, 0.12, { type: 'sine', gain: 0.07, glideTo: 420 }),
  resume: () => tone(420, 0, 0.12, { type: 'sine', gain: 0.08, glideTo: 820 }),
  skip: () => tone(620, 0, 0.09, { type: 'sine', gain: 0.08, glideTo: 980 }),
  subtask: () => bell(1567.98, 0, 0.07, 0.4),
  taskAdd: () => tone(523.25, 0, 0.1, { type: 'sine', gain: 0.08, glideTo: 784 }),
  goal: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => bell(f, i * 0.08, 0.1, 1.2));
  },
  park: () => tone(900, 0, 0.18, { type: 'sine', gain: 0.06, glideTo: 300 }),
  roll: () => {
    for (let i = 0; i < 10; i++) tone(500 + i * 60, i * 0.11, 0.06, { type: 'triangle', gain: 0.05 });
  },
  nudge: () => {
    bell(880, 0, 0.06, 0.7);
    bell(1174.66, 0.14, 0.05, 0.9);
  },
  tick: () => tone(1800, 0, 0.03, { type: 'square', gain: 0.012 }),
  streak: () => {
    tone(300, 0, 0.5, { type: 'sawtooth', gain: 0.03, glideTo: 1200 });
    [783.99, 987.77, 1174.66].forEach((f) => bell(f, 0.35, 0.08, 1.4));
  },
  break: () => {
    bell(587.33, 0, 0.1, 1.4);
    bell(880, 0.25, 0.08, 1.6);
  },
  achievement: () => {
    [659.25, 783.99, 987.77, 1318.5, 1567.98].forEach((f, i) => bell(f, i * 0.07, 0.09, 1));
    tone(2637, 0.4, 0.4, { type: 'sine', gain: 0.03 });
  },
};

let current: HTMLAudioElement | null = null;
let currentLevel = 0;
let currentAt = 0;
let queued: (() => void) | null = null;

/**
 * Session-sized moments win over small ones for their first few seconds: a badge or an auto-ticked
 * task right after "session complete" waits for it to finish instead of cutting it off. Everything
 * else simply plays (the newest action always gets its sound), so nothing can block sounds for long.
 */
const LEVEL: Partial<Record<Sfx, number>> = { complete: 3, goal: 3, streak: 3, early: 3, achievement: 2 };
const levelOf = (kind: Sfx) => LEVEL[kind] ?? 1;
const PROTECT_MS = 3500;

function playFile(src: string, level = 1, volume = 0.7) {
  try {
    const busy = current && !current.paused && !current.ended && performance.now() - currentAt < PROTECT_MS;
    if (busy && level < currentLevel) {
      // play it right after the big moment ends (only the latest follow-up waits)
      const big = current!;
      queued = () => playFile(src, level, volume);
      big.addEventListener('ended', () => {
        const q = queued;
        queued = null;
        if (current === big) q?.();
      }, { once: true });
      return;
    }
    queued = null;
    // a smaller sound that only just began (a badge a split second before "session complete") replays after
    const cut = busy && level > currentLevel && performance.now() - currentAt < 400 ? { src: current!.src, level: currentLevel } : null;
    current?.pause();
    const a = new Audio(src);
    a.volume = volume;
    current = a;
    currentLevel = level;
    currentAt = performance.now();
    void a.play().catch(() => {});
    if (cut) {
      queued = () => playFile(cut.src, cut.level, volume);
      a.addEventListener('ended', () => {
        const q = queued;
        queued = null;
        if (current === a) q?.();
      }, { once: true });
    }
  } catch {
    /* ignore */
  }
}

/** Play an interface/celebration sound respecting the user's sound pack. */
export function play(kind: Sfx) {
  const profile = useData.getState().data.settings.soundProfile;
  if (profile === 'off' && kind !== 'tick') return;
  try {
    if (profile === 'indian' && MEMES[kind]) {
      playFile(fx(pickFresh(kind)), levelOf(kind));
      return;
    }
    synth[kind]();
  } catch {
    /* audio blocked until interaction */
  }
}

export const previewPack = (profile: 'indian' | 'chimes') => {
  if (profile === 'indian') playFile(fx(pickFresh('complete')));
  else synth.complete();
};
