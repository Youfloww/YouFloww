import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CafeOrder } from '@/features/cafe/menu';

export type ThemeId = 'peach' | 'matcha' | 'lavender' | 'ocean' | 'strawberry' | 'midnight' | 'nebula';
export type SceneKind = 'aurora' | 'youtube' | 'image' | 'video' | 'plain';
export type EffectId = 'snow' | 'rain' | 'sakura' | 'fireflies' | 'stars' | 'bubbles';
export type TimerStyle = 'orb' | 'minimal';

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  kind: SceneKind;
  youtubeId?: string | null;
  /** a YouTube playlist: plays through and starts over (youtubeId, if set, is where it starts) */
  youtubeList?: string | null;
  /** IndexedDB key for uploaded image/video */
  mediaKey?: string | null;
}

interface PrefsState {
  theme: ThemeId;
  autoDark: boolean;
  scene: Scene;
  dim: number; // 0..0.8 overlay on top of media
  effects: Partial<Record<EffectId, boolean>>;
  effectDensity: number; // 0.2..2
  mixer: { volumes: Record<string, number>; on: Record<string, boolean>; master: number };
  timerStyle: TimerStyle;
  showMascot: boolean;
  showQuote: boolean;
  /** Meme image pop-ups when a focus session starts / ends */
  memePops: boolean;
  /** Halfway + 5-minutes-left nudges (time-blindness helper) */
  checkIns: boolean;
  /** Ask before anything ends a running session */
  confirmEnd: boolean;
  musicVideo: { id: string | null; list?: string | null; open: boolean; x: number; y: number };
  /** Where each panel window was last left (desktop) */
  windowRects: Partial<Record<string, WindowRect>>;
  lastSeenVersion: string | null;
  /** Last order at the café */
  cafeOrder: CafeOrder | null;
  /** Layers (src/features/registry) switched on or off by the person; missing = the layer's default */
  layers: Record<string, boolean>;

  set: (patch: Partial<Omit<PrefsState, 'set' | 'toggleEffect' | 'setVolume' | 'toggleTrack'>>) => void;
  toggleEffect: (id: EffectId) => void;
  setVolume: (track: string, v: number) => void;
  toggleTrack: (track: string, on?: boolean) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'peach',
      autoDark: false,
      scene: { kind: 'aurora' },
      dim: 0.25,
      effects: {},
      effectDensity: 1,
      mixer: { volumes: {}, on: {}, master: 0.8 },
      timerStyle: 'orb',
      showMascot: true,
      showQuote: true,
      memePops: true,
      checkIns: true,
      confirmEnd: true,
      musicVideo: { id: null, open: false, x: 24, y: 96 },
      windowRects: {},
      lastSeenVersion: null,
      cafeOrder: null,
      layers: {},

      set: (patch) => set(patch),
      toggleEffect: (id) => set((s) => ({ effects: { ...s.effects, [id]: !s.effects[id] } })),
      setVolume: (track, v) => set((s) => ({ mixer: { ...s.mixer, volumes: { ...s.mixer.volumes, [track]: v } } })),
      toggleTrack: (track, on) =>
        set((s) => ({ mixer: { ...s.mixer, on: { ...s.mixer.on, [track]: on ?? !s.mixer.on[track] } } })),
    }),
    { name: 'floww:prefs', version: 1 },
  ),
);

export const THEMES: { id: ThemeId; name: string; dark: boolean; swatch: [string, string, string]; emoji: string }[] = [
  { id: 'peach', name: 'Peach Fizz', dark: false, swatch: ['#FFD3B0', '#FF8A4C', '#9D7BFF'], emoji: '🍑' },
  { id: 'matcha', name: 'Matcha Latte', dark: false, swatch: ['#CDEBC0', '#4FA765', '#E7A93F'], emoji: '🍵' },
  { id: 'lavender', name: 'Lavender Haze', dark: false, swatch: ['#D9CCFF', '#8462FF', '#FF7FBF'], emoji: '💜' },
  { id: 'ocean', name: 'Ocean Soda', dark: false, swatch: ['#BFE7F7', '#1E9FD6', '#FF8F7A'], emoji: '🌊' },
  { id: 'strawberry', name: 'Strawberry Milk', dark: false, swatch: ['#FFC9D6', '#FF4F84', '#FFA43A'], emoji: '🍓' },
  { id: 'midnight', name: 'Midnight Bloom', dark: true, swatch: ['#3A2266', '#FF9A5A', '#A98BFF'], emoji: '🌙' },
  { id: 'nebula', name: 'Nebula', dark: true, swatch: ['#0E2C4D', '#58E1F5', '#C084FC'], emoji: '🪐' },
];
