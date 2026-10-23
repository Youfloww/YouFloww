import { useEffect, useState } from 'react';

/**
 * Cat skins. The art is one grey tabby; a skin re-paints its seven grey shades (and the eye colour) in the
 * browser, so every skin costs zero extra downloads and new ones are just a palette.
 */
export type SkinId = 'tabby' | 'ginger' | 'tuxedo' | 'snow' | 'latte' | 'cocoa' | 'lilac' | 'golden' | 'cosmic';

export interface Skin {
  id: SkinId;
  name: string;
  /** colours for the art's grey levels 48 / 96 / 128 / 152 / 200 / 224 / 255 (stripes -> white belly); null = the original */
  ramp: string[] | null;
  /** hue (0-1) for the irises */
  eyeHue?: number;
  /** bond level that unlocks it */
  unlock?: number;
  /** a soft glow around special skins */
  glow?: string;
}

export const SKINS: Skin[] = [
  { id: 'tabby', name: 'Smoky Tabby', ramp: null },
  { id: 'ginger', name: 'Ginger', ramp: ['#b04e1c', '#d76d2c', '#f08b3c', '#f7a659', '#fbd3a8', '#fff1e2', '#fffaf4'], eyeHue: 0.3 },
  { id: 'tuxedo', name: 'Tuxedo', ramp: ['#0f0f13', '#1a1a20', '#24242c', '#31313b', '#d7d7df', '#f3f3f6', '#ffffff'], eyeHue: 0.13 },
  { id: 'snow', name: 'Snowball', ramp: ['#b7bfcc', '#d5dae3', '#eceff4', '#f6f8fb', '#ffffff', '#ffffff', '#ffffff'], eyeHue: 0.6 },
  { id: 'latte', name: 'Latte', ramp: ['#7b4f33', '#a8774f', '#cfa57b', '#ddb994', '#f1dfc8', '#fbf4ea', '#fffaf3'], eyeHue: 0.58 },
  { id: 'cocoa', name: 'Cocoa', ramp: ['#3a2318', '#583523', '#72462e', '#86573b', '#d8b89c', '#f3e6d8', '#fffaf3'], eyeHue: 0.29 },
  { id: 'lilac', name: 'Lavender Dream', ramp: ['#7b5aaf', '#9a7dcf', '#b89be7', '#cab2ef', '#e9dcfb', '#f8f2ff', '#ffffff'], eyeHue: 0.9 },
  { id: 'golden', name: 'Golden Hour', ramp: ['#a46e0b', '#cc9116', '#efb428', '#f7ca4b', '#fde49a', '#fff5d5', '#fffdf2'], eyeHue: 0.42, unlock: 5, glow: 'drop-shadow(0 0 10px rgb(255 200 60 / .55))' },
  { id: 'cosmic', name: 'Cosmic', ramp: ['#1c1a48', '#2d296c', '#423c90', '#5550a9', '#a9a2e8', '#dcd8fb', '#ffffff'], eyeHue: 0.14, unlock: 7, glow: 'drop-shadow(0 0 10px rgb(150 130 255 / .6))' },
];
export const skinOf = (id: string | undefined) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Every strip a cat can show. */
export const STRIPS = ['idle', 'walk', 'run', 'jump', 'fall', 'slide', 'hurt', 'dead', 'idle-blink', 'idle-happy', 'idle-sad', 'idle-mad', 'idle-love', 'idle-star', 'walk-blink'] as const;
export type StripFile = (typeof STRIPS)[number];

const base = (file: string) => `/img/cat/${file}.webp`;
const STOPS = [0, 48, 96, 128, 152, 200, 224, 255];

function lutFor(ramp: string[]) {
  const cols = [[0, 0, 0], ...ramp.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    let k = 0;
    while (k < STOPS.length - 2 && v > STOPS[k + 1]) k++;
    const t = (v - STOPS[k]) / (STOPS[k + 1] - STOPS[k]);
    for (let c = 0; c < 3; c++) lut[v * 3 + c] = cols[k][c] + (cols[k + 1][c] - cols[k][c]) * t;
  }
  return lut;
}

async function paint(file: string, skin: Skin): Promise<string> {
  const img = new Image();
  img.src = base(file);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  const lut = lutFor(skin.ramp!);
  const eye = skin.eyeHue;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    if (mx - mn < 28) {
      // fur, outline, belly: a grey -> the skin's colour for that shade
      p[i] = lut[mx * 3];
      p[i + 1] = lut[mx * 3 + 1];
      p[i + 2] = lut[mx * 3 + 2];
    } else if (eye !== undefined && b >= r && g > r) {
      // cyan / teal irises -> the skin's eye hue (pink nose, tears and props are left alone)
      const d = mx - mn;
      const h = (mx === g ? 2 + (b - r) / d : 4 + (r - g) / d) / 6;
      if (h < 0.45 || h > 0.62 || d / mx < 0.25) continue;
      const s = d / mx;
      const v = mx;
      const hh = eye * 6;
      const f = hh - Math.floor(hh);
      const q = [v, v * (1 - s * f), v * (1 - s), v * (1 - s), v * (1 - s * (1 - f)), v];
      const sector = Math.floor(hh) % 6;
      const rgb = [
        [q[0], q[4], q[2]],
        [q[1], q[0], q[2]],
        [q[2], q[0], q[4]],
        [q[2], q[1], q[0]],
        [q[4], q[2], q[0]],
        [q[0], q[2], q[1]],
      ][sector];
      p[i] = rgb[0];
      p[i + 1] = rgb[1];
      p[i + 2] = rgb[2];
    }
  }
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.9));
  return blob ? URL.createObjectURL(blob) : base(file);
}

const ready = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** URL of a strip in a skin, painting it on first use. */
export function stripUrl(skinId: SkinId, file: StripFile): Promise<string> {
  const skin = skinOf(skinId);
  if (!skin.ramp) return Promise.resolve(base(file));
  const key = `${skin.id}:${file}`;
  const hit = ready.get(key);
  if (hit) return Promise.resolve(hit);
  let job = pending.get(key);
  if (!job) {
    job = paint(file, skin)
      .catch(() => base(file))
      .then((url) => {
        ready.set(key, url);
        return url;
      });
    pending.set(key, job);
  }
  return job;
}
export const stripUrlNow = (skinId: SkinId, file: StripFile) => (skinOf(skinId).ramp ? ready.get(`${skinId}:${file}`) : base(file));

/** Decoded images stay referenced here, so the browser never drops them from its cache. */
const warm = new Map<string, HTMLImageElement>();
function warmUp(url: string) {
  if (warm.has(url)) return Promise.resolve();
  const img = new Image();
  img.src = url;
  warm.set(url, img);
  return img.decode().catch(() => {});
}

/**
 * Paint and decode every strip of a skin up front: the first run, jump or blink never shows an
 * empty frame while its image downloads, and faces never flash in grey.
 */
export async function preloadSkin(skinId: SkinId) {
  for (const f of STRIPS) {
    await warmUp(await stripUrl(skinId, f));
    await new Promise((r) => setTimeout(r, 0)); // let a frame through between strips
  }
}

export function useStripUrl(skinId: SkinId, file: StripFile) {
  const [url, setUrl] = useState(() => stripUrlNow(skinId, file));
  useEffect(() => {
    let live = true;
    const now = stripUrlNow(skinId, file);
    if (now) setUrl(now);
    else void stripUrl(skinId, file).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [skinId, file]);
  return url;
}
