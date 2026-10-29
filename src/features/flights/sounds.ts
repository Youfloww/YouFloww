/** Tiny synthesized cabin sounds (no files): the seatbelt "bing-bong" and a passport stamp thunk. */
import { audioCtx } from '@/audio/context';
import { useData } from '@/store/data';
import { getFlights } from './store';

const allowed = () => useData.getState().data.settings.soundProfile !== 'off' && !getFlights().muted;

function note(c: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** The cabin chime: a soft high-low two-tone bell. */
export function seatbeltChime() {
  if (!allowed()) return;
  try {
    const c = audioCtx();
    for (const [f, at] of [
      [1046.5, 0],
      [830.6, 0.55],
    ] as const) {
      note(c, f, at, 1.6, 0.07);
      note(c, f * 2.01, at, 0.6, 0.012);
    }
  } catch {
    /* audio not unlocked yet */
  }
}

/** Rubber stamp on paper. */
export function stampThunk() {
  if (!allowed()) return;
  try {
    const c = audioCtx();
    note(c, 140, 0, 0.18, 0.18, 'triangle');
    note(c, 90, 0.01, 0.25, 0.12, 'sine');
  } catch {
    /* ignore */
  }
}

/** Boarding-pass scanner beep. */
export function scanBeep() {
  if (!allowed()) return;
  try {
    note(audioCtx(), 1568, 0, 0.16, 0.05, 'square');
  } catch {
    /* ignore */
  }
}
