/** The YouFloww Café: what's on the menu, cup sizes (= session length) and the regulars. Art lives in /img/cafe. */

export type DrinkId = 'latte' | 'matcha' | 'cappuccino' | 'cocoa' | 'chai' | 'strawberry';
export type SizeId = 'short' | 'tall' | 'grande' | 'venti';
export type CafeView = 'focus' | 'regulars' | 'window';

export interface CafeOrder {
  drink: DrinkId;
  size: SizeId;
  name: string;
  intent: string;
  /** order number on the ticket */
  no: number;
}

/** `steam`: where a hot drink's surface is, in percent of its image */
export const DRINKS: { id: DrinkId; name: string; note: string; hot: boolean; steam: [number, number] }[] = [
  { id: 'latte', name: 'Latte', note: 'smooth & steady', hot: true, steam: [49, 8] },
  { id: 'matcha', name: 'Iced matcha', note: 'calm, clear focus', hot: false, steam: [0, 0] },
  { id: 'cappuccino', name: 'Cappuccino', note: 'a classic kick', hot: true, steam: [46, 8] },
  { id: 'cocoa', name: 'Hot cocoa', note: 'cozy comfort', hot: true, steam: [42, 3] },
  { id: 'chai', name: 'Masala chai', note: 'spiced & warming', hot: true, steam: [47, 7] },
  { id: 'strawberry', name: 'Strawberry milk', note: 'a sweet little treat', hot: false, steam: [0, 0] },
];

export const SIZES: { id: SizeId; name: string; minutes: number; note: string; scale: number }[] = [
  { id: 'short', name: 'Short', minutes: 15, note: 'a quick sip', scale: 0.62 },
  { id: 'tall', name: 'Tall', minutes: 25, note: 'one pomodoro', scale: 0.76 },
  { id: 'grande', name: 'Grande', minutes: 45, note: 'deep work', scale: 0.88 },
  { id: 'venti', name: 'Venti', minutes: 60, note: 'the long haul', scale: 1 },
];

/** Where each regular sits in interior.webp (percent of the image), for their little name tags. */
export const REGULARS = [
  { name: 'Mochi', doing: 'is coding her app', x: 14, y: 27 },
  { name: 'Bruno', doing: 'is reading for an exam', x: 38, y: 25 },
  { name: 'Miso', doing: 'is writing in her diary', x: 60, y: 29 },
  { name: 'Pip', doing: 'is drawing with music on', x: 88, y: 27 },
];

export const VIEWS: { id: CafeView; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'regulars', label: 'Regulars' },
  { id: 'window', label: 'Window' },
];

export const drinkOf = (id: DrinkId) => DRINKS.find((d) => d.id === id) ?? DRINKS[0];
export const sizeOf = (id: SizeId) => SIZES.find((s) => s.id === id) ?? SIZES[1];
export const drinkImg = (id: DrinkId) => `/img/cafe/${id}.webp`;

export const CAFE_ART = ['storefront', 'interior', 'window', ...DRINKS.map((d) => d.id)].map((n) => `/img/cafe/${n}.webp`);
