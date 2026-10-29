export const ANIMALS = [
  { id: 'bunny', name: 'Bunny', emoji: '🐰', tint: '#f6c9d0' },
  { id: 'bear', name: 'Bear', emoji: '🐻', tint: '#d9b08c' },
  { id: 'cat', name: 'Tabby', emoji: '🐱', tint: '#c9ced6' },
  { id: 'fox', name: 'Fox', emoji: '🦊', tint: '#f2b48a' },
  { id: 'panda', name: 'Red panda', emoji: '🦝', tint: '#e0a07c' },
  { id: 'duck', name: 'Duckling', emoji: '🐥', tint: '#f7e0a0' },
  { id: 'owl', name: 'Owl', emoji: '🦉', tint: '#e8c3a4' },
  { id: 'frog', name: 'Frog', emoji: '🐸', tint: '#bcd8b0' },
] as const;

export const animalImg = (i: number) => `/img/together/animals/${ANIMALS[Math.max(0, Math.min(7, i | 0))].id}.webp`;
export const animalOf = (i: number) => ANIMALS[Math.max(0, Math.min(7, i | 0))];

/** The 12 seats on the hall painting: x, y (% of the painting, avatar centre) and a size factor for depth. */
export const SEATS: readonly (readonly [number, number, number])[] = [
  [53, 58, 0.85], [44.5, 58, 0.85], [61.5, 58, 0.85], [36, 58, 0.85], [70, 58, 0.85],
  [40, 80, 1.15], [58, 80, 1.15], [22, 80, 1.15], [76, 80, 1.15],
  [50, 47, 0.7], [43, 47, 0.7], [57, 47, 0.7],
];

export const KUDOS = {
  hf: { emoji: '🙌', label: 'High-five', said: 'sent you a high-five!' },
  kd: { emoji: '🌟', label: 'Kudos', said: 'sent you kudos!' },
  yg: { emoji: '💪', label: 'You got this', said: 'says you got this!' },
} as const;
export type KudosKind = keyof typeof KUDOS;
