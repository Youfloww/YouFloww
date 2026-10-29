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
  /** where the back wall meets the floor (items stand here) */
  base: number;
  /** wall spots (x, y centre) the painting leaves free */
  wall: [number, number][];
}

export const ROOMS: Room[] = [
  { id: 'living', name: 'Living room', emoji: '🛋️', price: 0, base: 0.72, wall: [[0.16, 0.34], [0.33, 0.3], [0.5, 0.34], [0.67, 0.3], [0.84, 0.34]] },
  { id: 'bedroom', name: 'Bedroom', emoji: '🌙', price: 250, base: 0.75, wall: [[0.16, 0.34], [0.33, 0.3], [0.5, 0.34], [0.67, 0.3], [0.84, 0.34]] },
  { id: 'sunroom', name: 'Sunroom', emoji: '🌿', price: 500, base: 0.79, wall: [[0.16, 0.34], [0.33, 0.3], [0.5, 0.34], [0.67, 0.3], [0.84, 0.34]] },
  { id: 'attic', name: 'Attic', emoji: '🌟', price: 800, base: 0.75, wall: [[0.16, 0.34], [0.33, 0.3], [0.5, 0.34], [0.67, 0.3], [0.84, 0.34]] },
];
export const roomOf = (id: string | undefined) => ROOMS.find((r) => r.id === id) ?? ROOMS[0];
export const roomImg = (id: RoomId) => `/img/cathome/room-${id}.webp`;

/** floor spots along the back wall, and two rug spots in the open floor */
export const FLOOR_X = [0.12, 0.27, 0.42, 0.58, 0.73, 0.88];
export const RUG_SPOTS: [number, number][] = [
  [0.33, 0.86],
  [0.67, 0.86],
];

export interface Slot {
  id: string;
  kind: SlotKind;
  x: number;
  y: number;
}
export function slotsOf(room: Room): Slot[] {
  return [
    ...room.wall.map(([x, y], i) => ({ id: `w${i}`, kind: 'wall' as const, x, y })),
    ...FLOOR_X.map((x, i) => ({ id: `f${i}`, kind: 'floor' as const, x, y: room.base + 0.03 })),
    ...RUG_SPOTS.map(([x, y], i) => ({ id: `r${i}`, kind: 'rug' as const, x, y })),
  ];
}

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
  /** her spot on it, as a fraction of its height from its base (for nap / sit / top) */
  perch?: number;
  use?: Use;
}

export const ITEMS: Item[] = [
  // floor
  { id: 'box', emoji: '📦', name: 'Cardboard box', kind: 'floor', price: 10, h: 0.13, perch: 0.75, use: 'sit' },
  { id: 'teddy', emoji: '🧸', name: 'Teddy bear', kind: 'floor', price: 20, h: 0.14, use: 'cuddle' },
  { id: 'toys', emoji: '🧶', name: 'Toy basket', kind: 'floor', price: 25, h: 0.13, use: 'play' },
  { id: 'monstera', emoji: '🪴', name: 'Monstera plant', kind: 'floor', price: 40, h: 0.32 },
  { id: 'sidetable', emoji: '🫖', name: 'Tea table', kind: 'floor', price: 55, h: 0.17 },
  { id: 'post', emoji: '🐾', name: 'Scratching post', kind: 'floor', price: 60, h: 0.3, use: 'scratch' },
  { id: 'floorlamp', emoji: '💡', name: 'Floor lamp', kind: 'floor', price: 70, h: 0.45 },
  { id: 'bed', emoji: '🛏️', name: 'Plush cat bed', kind: 'floor', price: 80, h: 0.12, perch: 0.45, use: 'nap' },
  { id: 'record', emoji: '📻', name: 'Record player', kind: 'floor', price: 120, h: 0.25, use: 'dance' },
  { id: 'armchair', emoji: '🛋️', name: 'Armchair', kind: 'floor', price: 150, h: 0.3, perch: 0.42, use: 'sit' },
  { id: 'bookshelf', emoji: '📚', name: 'Bookshelf', kind: 'floor', price: 160, h: 0.5 },
  { id: 'tree', emoji: '🏰', name: 'Cat tree', kind: 'floor', price: 220, h: 0.5, perch: 0.93, use: 'top' },
  { id: 'aquarium', emoji: '🐠', name: 'Aquarium', kind: 'floor', price: 280, h: 0.34, use: 'watch' },
  { id: 'fireplace', emoji: '🔥', name: 'Fireplace', kind: 'floor', price: 350, h: 0.36, use: 'warm' },
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
