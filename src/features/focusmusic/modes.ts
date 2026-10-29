/**
 * Focus-tuned modulation modes. The music itself is original (generated locally); the "tuning" is a slow-to-fast
 * rhythmic loudness wobble (amplitude modulation) laid over it, the idea behind neural-entrainment music.
 * No medical claims: this is a listening aid, not a treatment.
 */
export type ModeId = 'deep' | 'light' | 'flow' | 'calm';
export type TrackId = 'lofi' | 'piano' | 'pads' | 'synth';

export interface FocusMode {
  id: ModeId;
  label: string;
  emoji: string;
  blurb: string;
  /** modulation rate in Hz */
  hz: number;
  band: string;
  /** modulation depth at 100% intensity (0..1 of the loudness swing) */
  maxDepth: number;
  track: TrackId;
}

export const MODES: FocusMode[] = [
  { id: 'deep', label: 'Deep focus', emoji: '🎯', blurb: 'Steady beta-range pulse for hard, heads-down work', hz: 16, band: 'beta 16 Hz', maxDepth: 0.55, track: 'lofi' },
  { id: 'light', label: 'Light focus', emoji: '📖', blurb: 'A softer, slower beta pulse for reading and easy tasks', hz: 13, band: 'beta 13 Hz', maxDepth: 0.4, track: 'piano' },
  { id: 'flow', label: 'Creative flow', emoji: '🎨', blurb: 'Alpha-range pulse with open, dreamy sound', hz: 10, band: 'alpha 10 Hz', maxDepth: 0.45, track: 'synth' },
  { id: 'calm', label: 'Calm', emoji: '🌙', blurb: 'Slow alpha pulse and warm pads to settle down', hz: 8, band: 'alpha 8 Hz', maxDepth: 0.4, track: 'pads' },
];

export interface TrackInfo {
  id: TrackId;
  label: string;
  emoji: string;
  src: string;
  /** small make-up gain so all beds sit at the same loudness */
  gain: number;
  /** the seamless loop inside the file (seconds); the file has half a second of padding either side so codec edges never land on the seam */
  loopStart: number;
  loopEnd: number;
}

const LOOP = { loopStart: 0.5, loopEnd: 46.47 };

export const TRACKS: TrackInfo[] = [
  { id: 'lofi', label: 'Lo-fi keys', emoji: '🎹', src: '/sounds/focusmusic/lofi.mp3', gain: 1, ...LOOP },
  { id: 'piano', label: 'Soft piano', emoji: '🎼', src: '/sounds/focusmusic/piano.mp3', gain: 1, ...LOOP },
  { id: 'pads', label: 'Warm pads', emoji: '☁️', src: '/sounds/focusmusic/pads.mp3', gain: 1, ...LOOP },
  { id: 'synth', label: 'Gentle synthwave', emoji: '🌆', src: '/sounds/focusmusic/synth.mp3', gain: 1, ...LOOP },
];

export interface FocusMusicState {
  mode: ModeId;
  track: TrackId;
  /** 0..1 modulation intensity */
  intensity: number;
  /** 0..1 */
  volume: number;
  /** quiet binaural layer (needs headphones) */
  binaural: boolean;
  /** play only while a focus session is running */
  follow: boolean;
  open: boolean;
}

export const DEFAULTS: FocusMusicState = { mode: 'deep', track: 'lofi', intensity: 0.6, volume: 0.6, binaural: false, follow: false, open: false };
