import { buy, getWallet, itemCount, takeItem } from '@/features/economy/wallet';
import { useCat } from './brain';

/**
 * Snacks and toys for the care card, bought with fish coins (wallet items `cat:*`).
 * Each one nudges the brain's own needs (hunger / joy / energy); nothing here keeps stats of its own.
 */
export interface Food {
  id: string;
  name: string;
  emoji: string;
  price: number;
  hunger: number;
  joy: number;
  energy?: number;
  xp: number;
  /** a toy: she plays instead of eating */
  toy?: boolean;
  lines: string[];
}

export const FOODS: Food[] = [
  { id: 'cat:fish', name: 'Fish snack', emoji: '🐟', price: 5, hunger: 22, joy: 6, xp: 1, lines: ['Crunchy! 😋', 'Fishy fishy 🐟'] },
  { id: 'cat:milk', name: 'Milk', emoji: '🥛', price: 8, hunger: 12, joy: 10, energy: 12, xp: 1, lines: ['*lap lap lap* 🥛', 'Milk mustache 😸'] },
  { id: 'cat:tuna', name: 'Tuna can', emoji: '🥫', price: 12, hunger: 45, joy: 10, xp: 2, lines: ['TUNA!!! 😻', 'Best day ever 🥫'] },
  { id: 'cat:salmon', name: 'Salmon treat', emoji: '🍣', price: 20, hunger: 35, joy: 22, xp: 3, lines: ['Fancy! 🍣✨', 'I feel so spoiled 😻'] },
  { id: 'cat:cake', name: 'Fish cupcake', emoji: '🧁', price: 25, hunger: 25, joy: 30, xp: 3, lines: ['A party?! For me?! 🧁', 'Sweet and fishy 💕'] },
  { id: 'cat:catnip', name: 'Catnip toy', emoji: '🐭', price: 15, hunger: 0, joy: 28, energy: -8, xp: 2, toy: true, lines: ['CATNIP!!! 🌿', 'Wheee 🐭💨'] },
];
export const foodOf = (id: string) => FOODS.find((f) => f.id === id);
export const foodImg = (id: string) => `/img/cathome/food-${id.slice(4)}.webp`;

/**
 * Give her a snack: uses one she owns, or buys one on the spot.
 * 'poor' = not enough coins; 'full' = she couldn't eat another bite.
 */
export function serve(id: string): 'ok' | 'poor' | 'full' {
  const f = foodOf(id);
  if (!f) return 'poor';
  if (!f.toy && useCat.getState().hunger < 4) return 'full';
  if (itemCount(id) < 1 && !buy(id, priceOf(f.price))) return 'poor';
  takeItem(id);
  useCat.getState().treat({ hunger: f.hunger, joy: f.joy, energy: f.energy, xp: f.xp });
  return 'ok';
}

export const canAfford = (price: number) => getWallet().coins >= priceOf(price);

/** For now her snacks and everything in the Cat's Home (rooms, furniture) are free. Set to false to bring the prices back. */
export const FREE_FOR_NOW = true;
/** What something costs today (the catalogs keep the real prices) */
export function priceOf(price: number) {
  return FREE_FOR_NOW ? 0 : price;
}
