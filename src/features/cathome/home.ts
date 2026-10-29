import { buy, getWallet, giveItem, spend } from '@/features/economy/wallet';
import { getFeatureData, updateFeatureData, useFeatureData } from '@/lib/featureData';
import { HOME_EMPTY, HOME_KEY, type CatHomeData } from '../cat/study';
import { DECOR, ROOMS, itemOf, roomOf, slotsOf, type RoomId } from './catalog';

/** The Cat's Home state lives in data.catHome next to her crafts (see cat/study.ts). */
export const useHome = () => useFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY);
const read = () => getFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY);
const write = (fn: (d: CatHomeData) => void) =>
  updateFeatureData<CatHomeData>(HOME_KEY, HOME_EMPTY, (d) => {
    d.made ??= [];
    d.n ??= 0;
    d.rooms ??= ['living'];
    d.place ??= {};
    fn(d);
  });

export const unlockedRooms = (d: CatHomeData): RoomId[] => (d.rooms?.length ? (d.rooms as RoomId[]) : ['living']);
export const currentRoom = (d: CatHomeData): RoomId => {
  const r = roomOf(d.room).id;
  return unlockedRooms(d).includes(r) ? r : 'living';
};
export const placed = (d: CatHomeData, room: RoomId) => d.place?.[room] ?? {};

/** How many of an item stand somewhere in the house */
export function placedCount(d: CatHomeData, id: string) {
  let n = 0;
  for (const r of Object.values(d.place ?? {})) for (const v of Object.values(r)) if (v === id) n++;
  return n;
}
export const ownedCount = (items: Record<string, number>, id: string) => items[DECOR(id)] ?? 0;

/** First visit: a free cardboard box (every cat's favourite) already in the living room */
export function welcome() {
  const d = read();
  if (d.rooms?.length) return;
  if (!ownedCount(getWallet().items, 'box')) giveItem(DECOR('box'));
  write((d) => {
    d.rooms = ['living'];
    d.room = 'living';
    d.place = { living: { f1: 'box' } };
  });
}

export const goRoom = (room: RoomId) => write((d) => void (d.room = room));

export function buyRoom(room: RoomId): boolean {
  const r = ROOMS.find((x) => x.id === room);
  if (!r || unlockedRooms(read()).includes(room)) return false;
  if (!spend(r.price, `room:${room}`)) return false;
  write((d) => {
    d.rooms = [...unlockedRooms(d), room];
    d.room = room;
  });
  return true;
}

/** Buy a piece; it goes straight into a free spot of the room you're in when there is one. Returns that spot. */
export function buyDecor(id: string, room: RoomId): 'poor' | string | null {
  const it = itemOf(id);
  if (!it) return 'poor';
  if (!buy(DECOR(id), it.price)) return 'poor';
  const d = read();
  const taken = placed(d, room);
  const free = slotsOf(roomOf(room)).filter((s) => s.kind === it.kind && !taken[s.id]);
  if (!free.length) return null;
  // floor pieces fill from the middle out, so the room grows evenly
  const pickSlot = it.kind === 'floor' ? [...free].sort((a, b) => Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5))[0] : free[0];
  placeAt(room, pickSlot.id, id);
  return pickSlot.id;
}

/** Put an item into a slot (moving it from `from` when given; whatever stood there swaps back) */
export function placeAt(room: RoomId, slot: string, id: string, from?: string) {
  write((d) => {
    const r = (d.place![room] ??= {});
    const was = r[slot];
    if (from && from !== slot) {
      delete r[from];
      if (was) r[from] = was;
    }
    r[slot] = id;
  });
}

export function putAway(room: RoomId, slot: string) {
  write((d) => {
    if (d.place?.[room]) delete d.place[room][slot];
  });
}
