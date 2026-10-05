import { useData } from '@/store/data';
import { pick } from '@/lib/utils';
import { audioCtx } from './context';

export type Sfx = 'start' | 'complete' | 'early' | 'task' | 'pop' | 'streak' | 'tick' | 'break' | 'achievement' | 'pause';

const MEMES = {
  start: ['start-sound1', 'start-sound2', 'start-sound3', 'start-sound4'],
  complete: ['good-meme1', 'good-meme2', 'good-meme3', 'good-meme4'],
  early: ['bad-meme1', 'bad-meme2', 'bad-meme3', 'bad-meme4'],
} as const;

const fx = (name: string) => `/sounds/fx/${name}.mp3`;

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

function playFile(src: string, volume = 0.7) {
  try {
    current?.pause();
    const a = new Audio(src);
    a.volume = volume;
    current = a;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Play an interface/celebration sound respecting the user's sound pack. */
export function play(kind: Sfx) {
  const profile = useData.getState().data.settings.soundProfile;
  if (profile === 'off' && kind !== 'tick') return;
  try {
    if (profile === 'indian' && (kind === 'start' || kind === 'complete' || kind === 'early')) {
      playFile(fx(pick(MEMES[kind])));
      return;
    }
    synth[kind]();
  } catch {
    /* audio blocked until interaction */
  }
}

export const previewPack = (profile: 'indian' | 'chimes') => {
  if (profile === 'indian') playFile(fx(pick(MEMES.complete)));
  else synth.complete();
};
