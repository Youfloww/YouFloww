/**
 * Fish coins 🐟: earned by focusing, spent in the cat's shop, the garden and other worlds.
 * One wallet for every feature, saved with the user's data (data.wallet).
 */
import { useMemo } from 'react';
import { bus } from '@/lib/bus';
import { getFeatureData, updateFeatureData, useFeatureData } from '@/lib/featureData';

export interface Wallet {
  coins: number;
  /** all coins ever earned (for levels and badges) */
  earned: number;
  /** owned items by id (food, seeds, furniture, ...) */
  items: Record<string, number>;
}

const KEY = 'wallet';
const EMPTY: Wallet = { coins: 0, earned: 0, items: {} };

/** A stored wallet can miss fields (an older or partly synced copy): fill them in, never NaN. */
const fill = (w: Partial<Wallet> | undefined): Wallet => ({
  coins: Number.isFinite(w?.coins) ? (w!.coins as number) : 0,
  earned: Number.isFinite(w?.earned) ? (w!.earned as number) : 0,
  items: w?.items && typeof w.items === 'object' ? w.items : {},
});

export function useWallet() {
  const raw = useFeatureData<Partial<Wallet>>(KEY, EMPTY);
  return useMemo(() => fill(raw), [raw]);
}
export const getWallet = () => fill(getFeatureData<Partial<Wallet>>(KEY, EMPTY));

/** Change the wallet, repairing missing fields first. */
function edit(fn: (w: Wallet) => void) {
  updateFeatureData<Wallet>(KEY, EMPTY, (w) => {
    Object.assign(w, fill(w));
    fn(w);
  });
}

export function earn(amount: number, reason: string) {
  const n = Math.max(0, Math.round(amount));
  if (!n) return;
  edit((w) => {
    w.coins += n;
    w.earned += n;
  });
  bus.emit('wallet:earn', { amount: n, reason });
}

/** Pay for something. False (and nothing changes) when there aren't enough coins. */
export function spend(amount: number, reason: string): boolean {
  const n = Math.max(0, Math.round(amount));
  if (getWallet().coins < n) return false;
  edit((w) => {
    w.coins -= n;
  });
  bus.emit('wallet:spend', { amount: n, reason });
  return true;
}

export const itemCount = (id: string) => getWallet().items[id] ?? 0;

export function giveItem(id: string, n = 1) {
  edit((w) => {
    w.items[id] = (w.items[id] ?? 0) + n;
  });
}

/** Use up an owned item. False when there is none left. */
export function takeItem(id: string, n = 1): boolean {
  if (itemCount(id) < n) return false;
  edit((w) => {
    w.items[id] -= n;
    if (w.items[id] <= 0) delete w.items[id];
  });
  return true;
}

/** Buy an item with coins in one step. */
export function buy(id: string, price: number, n = 1): boolean {
  if (!spend(price * n, `buy:${id}`)) return false;
  giveItem(id, n);
  return true;
}
