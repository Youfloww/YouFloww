import { create } from 'zustand';
import { audioCtx } from './context';

export interface Track {
  id: string;
  label: string;
  emoji: string;
  kind: 'file' | 'brown' | 'pink' | 'white' | 'beats';
  src?: string;
  group: 'nature' | 'cozy' | 'noise' | 'music';
  hint?: string;
}

export const TRACKS: Track[] = [
  { id: 'storm', label: 'Rainstorm', emoji: '⛈️', kind: 'file', src: '/sounds/ambient/storm.mp3', group: 'nature' },
  { id: 'forest', label: 'Forest', emoji: '🌲', kind: 'file', src: '/sounds/ambient/forest.mp3', group: 'nature' },
  { id: 'night', label: 'Crickets', emoji: '🦗', kind: 'file', src: '/sounds/ambient/night.mp3', group: 'nature' },
  { id: 'fireplace', label: 'Fireplace', emoji: '🔥', kind: 'file', src: '/sounds/ambient/fireplace.mp3', group: 'cozy' },
  { id: 'cafe', label: 'Café', emoji: '☕', kind: 'file', src: '/sounds/ambient/cafe.mp3', group: 'cozy' },
  { id: 'purr', label: 'Cat purr', emoji: '🐈', kind: 'file', src: '/sounds/ambient/purr.mp3', group: 'cozy' },
  { id: 'brown', label: 'Brown noise', emoji: '🟤', kind: 'brown', group: 'noise', hint: 'Deep & warm' },
  { id: 'pink', label: 'Pink noise', emoji: '🌸', kind: 'pink', group: 'noise', hint: 'Soft & balanced' },
  { id: 'white', label: 'White noise', emoji: '🤍', kind: 'white', group: 'noise', hint: 'Crisp masking' },
  { id: 'beats', label: 'Focus beats', emoji: '🧠', kind: 'beats', group: 'noise', hint: '40Hz binaural · headphones' },
  { id: 'vinyl', label: 'Lo-fi vinyl', emoji: '💿', kind: 'file', src: '/sounds/ambient/vinyl.mp3', group: 'music' },
];

export const PRESETS: { name: string; emoji: string; mix: Record<string, number> }[] = [
  { name: 'Rainy café', emoji: '🌧️', mix: { storm: 0.45, cafe: 0.55 } },
  { name: 'Cabin night', emoji: '🏕️', mix: { fireplace: 0.6, night: 0.35 } },
  { name: 'Deep work', emoji: '🎧', mix: { brown: 0.5, beats: 0.25 } },
  { name: 'Forest nap', emoji: '🍃', mix: { forest: 0.6, purr: 0.3 } },
  { name: 'Lo-fi study', emoji: '📚', mix: { vinyl: 0.6, storm: 0.2 } },
];

type Status = 'idle' | 'loading' | 'playing' | 'error';
export const useMixerStatus = create<{ status: Record<string, Status> }>(() => ({ status: {} }));
const setStatus = (id: string, s: Status) =>
  useMixerStatus.setState((st) => (st.status[id] === s ? st : { status: { ...st.status, [id]: s } }));

interface Voice {
  gain: GainNode;
  stop?: () => void;
  el?: HTMLAudioElement;
  started: boolean;
  idleTimer?: ReturnType<typeof setTimeout>;
}

const voices = new Map<string, Voice>();
let master: GainNode | null = null;
let customUrl: string | null = null;

function getMaster() {
  const c = audioCtx();
  if (!master) {
    master = c.createGain();
    // gentle limiter so stacked layers never clip
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master.connect(comp).connect(c.destination);
  }
  return master;
}

function noiseBuffer(kind: 'brown' | 'pink' | 'white') {
  const c = audioCtx();
  const len = c.sampleRate * 6;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = w * 0.35;
      else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.2;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
        b6 = w * 0.115926;
      }
    }
    // crossfade the loop seam
    const fade = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[len - fade + i] * (1 - t);
    }
  }
  return buf;
}

function createVoice(track: Track): Voice {
  const c = audioCtx();
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(getMaster());
  const v: Voice = { gain, started: false };

  if (track.kind === 'file' || track.id === 'custom') {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.src = track.id === 'custom' ? customUrl ?? '' : track.src!;
    el.addEventListener('playing', () => setStatus(track.id, 'playing'));
    el.addEventListener('waiting', () => setStatus(track.id, 'loading'));
    el.addEventListener('error', () => setStatus(track.id, 'error'));
    c.createMediaElementSource(el).connect(gain);
    v.el = el;
    v.stop = () => el.pause();
  }
  return v;
}

function start(track: Track, v: Voice) {
  const c = audioCtx();
  if (v.el) {
    setStatus(track.id, 'loading');
    void v.el.play().catch(() => setStatus(track.id, 'error'));
  } else if (track.kind === 'beats') {
    const l = c.createOscillator();
    const r = c.createOscillator();
    l.frequency.value = 200;
    r.frequency.value = 240; // 40Hz gamma difference
    const merger = c.createChannelMerger(2);
    const lg = c.createGain();
    const rg = c.createGain();
    lg.gain.value = rg.gain.value = 0.25;
    l.connect(lg).connect(merger, 0, 0);
    r.connect(rg).connect(merger, 0, 1);
    merger.connect(v.gain);
    l.start();
    r.start();
    v.stop = () => {
      l.stop();
      r.stop();
    };
    setStatus(track.id, 'playing');
  } else {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(track.kind as 'brown' | 'pink' | 'white');
    src.loop = true;
    src.connect(v.gain);
    src.start();
    v.stop = () => src.stop();
    setStatus(track.id, 'playing');
  }
  v.started = true;
}

/** Bring the audio graph in line with desired volumes. Cheap to call often. */
export function syncMixer(levels: Record<string, number>, masterLevel: number) {
  const anyOn = Object.values(levels).some((x) => x > 0);
  if (!anyOn && !master) return; // never touched audio: don't create a context
  const c = audioCtx();
  const m = getMaster();
  m.gain.setTargetAtTime(masterLevel, c.currentTime, 0.15);

  const all = [...TRACKS, ...(customUrl ? [customTrack()] : [])];
  for (const track of all) {
    const target = Math.max(0, Math.min(1, levels[track.id] ?? 0));
    let v = voices.get(track.id);
    if (target > 0) {
      if (!v) {
        v = createVoice(track);
        voices.set(track.id, v);
      }
      clearTimeout(v.idleTimer);
      if (!v.started || (v.el && v.el.paused)) start(track, v);
      v.gain.gain.setTargetAtTime(target * target, c.currentTime, 0.25); // perceptual curve
    } else if (v && v.started) {
      v.gain.gain.setTargetAtTime(0, c.currentTime, 0.2);
      const voice = v;
      clearTimeout(voice.idleTimer);
      voice.idleTimer = setTimeout(() => {
        voice.stop?.();
        voice.started = false;
        if (!voice.el) voices.delete(track.id); // synth voices are rebuilt next time
        setStatus(track.id, 'idle');
      }, 1200);
    }
  }
}

export function customTrack(): Track {
  return { id: 'custom', label: 'Your music', emoji: '🎵', kind: 'file', group: 'music' };
}

export function setCustomMusic(url: string | null) {
  const v = voices.get('custom');
  if (v?.el) {
    v.stop?.();
    v.el.src = url ?? '';
    v.started = false;
  }
  customUrl = url;
}
export const hasCustomMusic = () => !!customUrl;
