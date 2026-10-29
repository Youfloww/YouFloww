import { audioCtx } from '@/audio/context';
import { useData } from '@/store/data';

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const c = audioCtx();
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

/** Soft sounds for the hall. `kudos` = a warm two-note chime, `join` = a tiny pop, `bloom` = a rising arpeggio. */
let muted = false;
export const setHallMuted = (m: boolean) => void (muted = m);

export function hallSound(kind: 'kudos' | 'join' | 'bloom' | 'sad') {
  if (muted) return;
  if (useData.getState().data.settings.soundProfile === 'off') return;
  try {
    if (kind === 'kudos') {
      [659.25, 987.77].forEach((f, i) => {
        tone(f, i * 0.11, 0.9, 0.09);
        tone(f * 2, i * 0.11, 0.5, 0.025);
      });
    } else if (kind === 'join') tone(880, 0, 0.18, 0.05);
    else if (kind === 'bloom') [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.1, 1.1, 0.08));
    else {
      tone(392, 0, 0.5, 0.06, 'triangle');
      tone(330, 0.25, 0.7, 0.05, 'triangle');
    }
  } catch {
    /* audio blocked until the first tap */
  }
}
