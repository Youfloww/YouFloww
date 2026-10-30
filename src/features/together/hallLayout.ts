/**
 * The 2.5D library hall, in "room units": the room painting is 1 unit tall and ROOM_W units wide.
 * Three rows of tables (back 5, middle 4, front 3) seat 3 each = 36 seats. Slot s0 is the front-centre seat
 * and the slots fill outwards and backwards, so a quiet hall still looks cosy in the middle.
 */
export const ROOM_W = 2048 / 868;
export const SEAT_LIMIT = 36;
const TABLE_ASPECT = 720 / 346;
/** table sprite: top surface far edge at 26.6 % of its height; usable top from 13 % to 89 % of its width */
const TABLE_TOP = 0.266;
const TABLE_W = 0.56;
const SEAT_F = [0.27, 0.51, 0.75];

export interface TableSpot {
  x: number;
  /** y of the table's far edge (where avatars sit) */
  y: number;
  w: number;
  h: number;
  /** css top of the sprite */
  top: number;
  scale: number;
  row: number;
  flip: boolean;
}
export interface SeatSpot {
  x: number;
  y: number;
  size: number;
  scale: number;
  row: number;
}

const ROWS = [
  { y: 0.668, scale: 0.6, n: 5, span: 0.84 },
  { y: 0.757, scale: 0.78, n: 4, span: 0.86 },
  { y: 0.872, scale: 1, n: 3, span: 0.8 },
];

export const TABLES: TableSpot[] = [];
const spots: SeatSpot[] = [];
ROWS.forEach((r, row) => {
  const w = TABLE_W * r.scale;
  const h = w / TABLE_ASPECT;
  const left = (ROOM_W * (1 - r.span)) / 2;
  const step = (ROOM_W * r.span) / r.n;
  for (let i = 0; i < r.n; i++) {
    const cx = left + step * (i + 0.5);
    TABLES.push({ x: cx, y: r.y, w, h, top: r.y - TABLE_TOP * h, scale: r.scale, row, flip: (i + row) % 2 === 1 });
    for (const f of SEAT_F) {
      const size = 0.118 * r.scale;
      const fx = TABLES[TABLES.length - 1].flip ? 1 - f : f;
      spots.push({ x: cx + (fx - 0.5) * w, y: r.y - size * 0.34, size, scale: r.scale, row });
    }
  }
});

/** SEATS[slot] = where slot `s{slot}` sits. Front row first, centre outwards. */
export const SEATS: SeatSpot[] = spots
  .map((s, i) => ({ s, i, k: (2 - s.row) * 10 + Math.abs(s.x - ROOM_W / 2) }))
  .sort((a, b) => a.k - b.k)
  .map((x) => x.s);

/** Foreground props (parallax layer, moves faster than the room). x in 0..1 of the layer, h in room units. */
export const PROPS: { img: string; x: number; h: number; drop: number; blur?: number }[] = [
  { img: 'monstera', x: 0.01, h: 0.42, drop: 0.07 },
  { img: 'books', x: 0.2, h: 0.24, drop: 0.06 },
  { img: 'fern', x: 0.39, h: 0.36, drop: 0.08 },
  { img: 'cart', x: 0.6, h: 0.27, drop: 0.06 },
  { img: 'lamp', x: 0.79, h: 0.5, drop: 0.05 },
  { img: 'monstera', x: 0.93, h: 0.4, drop: 0.08 },
];
