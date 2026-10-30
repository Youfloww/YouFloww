import { PIC } from './picmeta';

/**
 * Everything for the Cat's Home: rooms, furniture and where things can stand.
 * Positions are fractions of the room painting (x of its width, y of its height).
 */
export type SlotKind = 'floor' | 'wall' | 'rug';
export type RoomId = 'living' | 'bedroom' | 'sunroom' | 'attic';

export interface Room {
  id: RoomId;
  name: string;
  emoji: string;
  price: number;
  /** where the back wall meets the floor in the painting (y, fraction of the room's height) */
  base: number;
  /** the two depth rows of the floor: y of the back row and of the front row (where feet touch the floor) */
  rows: [number, number];
  /** wall spots (x, y centre) the painting leaves free */
  wall: [number, number][];
  /** light: which way shadows fall (-1 left .. 1 right, as a share of an item's height), and how dark they are */
  light: { dx: number; dark: number };
  /** colour grade for the cut-outs so they sit in the room's light */
  grade: string;
}

const WALL_LIVING: [number, number][] = [[0.16, 0.34], [0.33, 0.3], [0.5, 0.34], [0.67, 0.3], [0.84, 0.34]];
export const ROOMS: Room[] = [
  { id: 'living', name: 'Living room', emoji: '🛋️', price: 0, base: 0.745, rows: [0.785, 0.89], wall: WALL_LIVING, light: { dx: -0.05, dark: 0.55 }, grade: 'saturate(1.03)' },
  // window top right: light comes from the right, shadows lean left
  { id: 'bedroom', name: 'Bedroom', emoji: '🌙', price: 250, base: 0.755, rows: [0.795, 0.895], wall: [[0.1, 0.34], [0.25, 0.3], [0.4, 0.34], [0.55, 0.3], [0.8, 0.66]], light: { dx: -0.14, dark: 0.55 }, grade: 'brightness(0.95) saturate(0.93) hue-rotate(-5deg)' },
  // big windows behind: bright room, soft short shadows toward the viewer
  { id: 'sunroom', name: 'Sunroom', emoji: '🌿', price: 500, base: 0.83, rows: [0.875, 0.945], wall: WALL_LIVING, light: { dx: 0.03, dark: 0.42 }, grade: 'brightness(1.02) saturate(1.04) hue-rotate(3deg)' },
  // dim, warm, a round window in the middle: tight dark shadows
  { id: 'attic', name: 'Attic', emoji: '🌟', price: 800, base: 0.8, rows: [0.84, 0.92], wall: [[0.16, 0.55], [0.33, 0.52], [0.5, 0.55], [0.67, 0.52], [0.84, 0.55]], light: { dx: 0, dark: 0.62 }, grade: 'brightness(0.92) sepia(0.12) saturate(0.97)' },
];
export const roomOf = (id: string | undefined) => ROOMS.find((r) => r.id === id) ?? ROOMS[0];
export const roomImg = (id: RoomId) => `/img/cathome/room-${id}.webp`;

/** floor spots: a back row along the wall (f0-f5) and a front row between them, nearer to you (f6-f9) */
export const FLOOR_X = [0.12, 0.27, 0.42, 0.58, 0.73, 0.88];
export const FRONT_X = [0.2, 0.4, 0.6, 0.8];
export const RUG_X = [0.33, 0.67];

export interface Slot {
  id: string;
  kind: SlotKind;
  x: number;
  y: number;
  /** floor depth row: 0 = back, 1 = front */
  row?: 0 | 1;
}
export function slotsOf(room: Room): Slot[] {
  const [yb, yf] = room.rows;
  return [
    ...room.wall.map(([x, y], i) => ({ id: `w${i}`, kind: 'wall' as const, x, y })),
    ...FLOOR_X.map((x, i) => ({ id: `f${i}`, kind: 'floor' as const, x, y: yb, row: 0 as const })),
    ...FRONT_X.map((x, i) => ({ id: `f${6 + i}`, kind: 'floor' as const, x, y: yf, row: 1 as const })),
    ...RUG_X.map((x, i) => ({ id: `r${i}`, kind: 'rug' as const, x, y: (yb + yf) / 2 + 0.005 })),
  ];
}

/** Perspective: things nearer the front are bigger. 1 at the back row (the horizon sits half a room above the wall's foot). */
export function depthScale(room: Room, y: number) {
  const hz = room.base - 0.5;
  return (y - hz) / (room.rows[0] - hz);
}
/** Size of a placed piece in room heights (rugs: room widths), after trimming and perspective */
export function sizeOf(it: Item, slot: Slot, room: Room) {
  const m = PIC[it.id];
  const s = it.kind === 'floor' || it.kind === 'rug' ? depthScale(room, slot.y) : 1;
  if (!m) return { k: it.h * s, s };
  return { k: (it.kind === 'rug' ? it.h * (m.w / m.ow) : it.h * (m.h / m.oh)) * s, s };
}
/** back-to-front order: nearer things (bigger y) paint over farther ones; the cat uses the same scale */
export const zOfY = (y: number) => 10 + Math.round(y * 1000);

/** What she does with a piece of furniture when she visits it */
export type Use = 'nap' | 'sit' | 'top' | 'scratch' | 'watch' | 'play' | 'cuddle' | 'warm' | 'dance';

export interface Item {
  id: string;
  /** stands in while its picture loads (or if it can't) */
  emoji: string;
  name: string;
  kind: SlotKind;
  price: number;
  /** height as a fraction of the room's height (rugs: width as a fraction of the room's width) */
  h: number;
  /** her spot on it, as a fraction of its (trimmed) height from its base (for nap / sit / top) */
  perch?: number;
  use?: Use;
  /** stands against the back wall (a bookshelf in the middle of the room looks wrong): back floor row only */
  byWall?: boolean;
}

/** Can this item stand in this spot? */
export const fitsSlot = (it: Item | undefined, s: Slot) => !!it && it.kind === s.kind && !(it.byWall && s.row === 1);

export const ITEMS: Item[] = [
  // floor
  { id: 'box', emoji: '📦', name: 'Cardboard box', kind: 'floor', price: 10, h: 0.13, perch: 0.79, use: 'sit' },
  { id: 'teddy', emoji: '🧸', name: 'Teddy bear', kind: 'floor', price: 20, h: 0.14, use: 'cuddle' },
  { id: 'toys', emoji: '🧶', name: 'Toy basket', kind: 'floor', price: 25, h: 0.13, use: 'play' },
  { id: 'monstera', emoji: '🪴', name: 'Monstera plant', kind: 'floor', price: 40, h: 0.32 },
  { id: 'sidetable', emoji: '🫖', name: 'Tea table', kind: 'floor', price: 55, h: 0.17 },
  { id: 'post', emoji: '🐾', name: 'Scratching post', kind: 'floor', price: 60, h: 0.3, use: 'scratch' },
  { id: 'floorlamp', emoji: '💡', name: 'Floor lamp', kind: 'floor', price: 70, h: 0.45 },
  { id: 'bed', emoji: '🛏️', name: 'Plush cat bed', kind: 'floor', price: 80, h: 0.12, perch: 0.4, use: 'nap' },
  { id: 'record', emoji: '📻', name: 'Record player', kind: 'floor', price: 120, h: 0.25, use: 'dance' },
  { id: 'armchair', emoji: '🛋️', name: 'Armchair', kind: 'floor', price: 150, h: 0.3, perch: 0.385, use: 'sit' },
  { id: 'bookshelf', emoji: '📚', name: 'Bookshelf', kind: 'floor', price: 160, h: 0.5, byWall: true },
  { id: 'tree', emoji: '🏰', name: 'Cat tree', kind: 'floor', price: 220, h: 0.5, perch: 0.98, use: 'top' },
  { id: 'aquarium', emoji: '🐠', name: 'Aquarium', kind: 'floor', price: 280, h: 0.34, use: 'watch', byWall: true },
  { id: 'fireplace', emoji: '🔥', name: 'Fireplace', kind: 'floor', price: 350, h: 0.36, use: 'warm', byWall: true },
  // wall
  { id: 'fishposter', emoji: '🐟', name: 'Fish poster', kind: 'wall', price: 15, h: 0.19 },
  { id: 'clock', emoji: '🕰️', name: 'Paw clock', kind: 'wall', price: 30, h: 0.14 },
  { id: 'macrame', emoji: '🌿', name: 'Hanging plant', kind: 'wall', price: 35, h: 0.26 },
  { id: 'lights', emoji: '✨', name: 'Fairy lights', kind: 'wall', price: 45, h: 0.1 },
  { id: 'portrait', emoji: '🖼️', name: 'Cat portrait', kind: 'wall', price: 45, h: 0.21 },
  { id: 'shelf', emoji: '🪴', name: 'Plant shelf', kind: 'wall', price: 60, h: 0.15 },
  { id: 'window', emoji: '🪟', name: 'Little window', kind: 'wall', price: 90, h: 0.28 },
  // rugs
  { id: 'rug-round', emoji: '🌸', name: 'Fluffy round rug', kind: 'rug', price: 30, h: 0.24 },
  { id: 'rug-stripe', emoji: '🟩', name: 'Striped rug', kind: 'rug', price: 50, h: 0.28 },
  { id: 'rug-fish', emoji: '🐟', name: 'Fish rug', kind: 'rug', price: 90, h: 0.28 },
];
export const itemOf = (id: string) => ITEMS.find((i) => i.id === id);
export const itemImg = (id: string) => `/img/cathome/home-${id}.webp`;
/** wallet item id for an owned piece of furniture */
export const DECOR = (id: string) => `home:${id}`;
