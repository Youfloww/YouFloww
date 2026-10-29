/** Time of day outside the train window, from the person's own clock. */

export type TodId = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';

export interface Tod {
  id: TodId;
  label: string;
  emoji: string;
  /** maplibre sky */
  sky: string;
  horizon: string;
  fog: string;
  /** colour laid over the landscape (multiply) */
  tint: string;
  /** satellite brightness ceiling + saturation */
  bright: number;
  sat: number;
  /** carriage interior glow */
  lamp: number;
}

const T: Record<TodId, Tod> = {
  dawn: { id: 'dawn', label: 'Dawn', emoji: '🌅', sky: '#9fb6e6', horizon: '#ffc9a8', fog: '#f6d2c4', tint: 'rgb(255 196 170 / 0.32)', bright: 0.92, sat: 0, lamp: 0.35 },
  day: { id: 'day', label: 'Daytime', emoji: '☀️', sky: '#6fa8e8', horizon: '#d8ecff', fog: '#e4eef6', tint: 'rgb(255 248 236 / 0.08)', bright: 1, sat: 0.08, lamp: 0 },
  golden: { id: 'golden', label: 'Golden hour', emoji: '🌇', sky: '#88a9dc', horizon: '#ffd08a', fog: '#f8dcb0', tint: 'rgb(255 190 110 / 0.34)', bright: 0.97, sat: 0.12, lamp: 0.25 },
  dusk: { id: 'dusk', label: 'Dusk', emoji: '🌆', sky: '#55609e', horizon: '#f2a0a8', fog: '#b9a2c4', tint: 'rgb(150 120 200 / 0.42)', bright: 0.72, sat: -0.15, lamp: 0.7 },
  night: { id: 'night', label: 'Night', emoji: '🌙', sky: '#0c1430', horizon: '#2a3466', fog: '#202a4e', tint: 'rgb(40 55 120 / 0.62)', bright: 0.42, sat: -0.35, lamp: 1 },
};

export function todAt(d = new Date()): Tod {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 5 || h >= 21) return T.night;
  if (h < 7.5) return T.dawn;
  if (h < 16.5) return T.day;
  if (h < 18.5) return T.golden;
  return T.dusk;
}

export const TODS = T;
