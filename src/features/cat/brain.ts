import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { bus } from '@/lib/bus';
import { pick } from '@/lib/utils';
import { SKINS, skinOf, type SkinId } from './skins';

/**
 * The cat's brain: needs that drift over real time (saved, so she remembers you between visits),
 * a mood derived from them, a bond that grows with every focus session, and a family that grows
 * with the bond. CatWorld turns this into behaviour.
 */
export type CatMood = 'annoyed' | 'sleepy' | 'hungry' | 'sad' | 'loved' | 'playful' | 'happy' | 'content';
export type FamilyStage = 'single' | 'dating' | 'expecting' | 'family';

export interface CatNeeds {
  /** 0 = full, 100 = starving */
  hunger: number;
  /** 0 = exhausted, 100 = bouncing */
  energy: number;
  /** 0 = gloomy, 100 = delighted */
  joy: number;
  /** grows slowly with pets and focus sessions */
  affection: number;
}

export interface Kitten {
  id: string;
  name: string;
  skin: SkinId;
  born: number;
}

interface CatState extends CatNeeds {
  name: string;
  skin: SkinId;
  /** earned by finishing focus sessions, eaten when hungry */
  treats: number;
  asleep: boolean;
  annoyedUntil: number;
  lastTick: number;
  /** bond points: focus sessions, pets and meals */
  xp: number;
  /** focus sessions finished together */
  together: number;
  stage: FamilyStage;
  partner: { name: string; skin: SkinId } | null;
  /** `together` when she started expecting; kittens arrive a few sessions later */
  expectingAt: number;
  kittens: Kitten[];
  /** soft purring now and then */
  purrs: boolean;
  /** little pep talks during focus sessions */
  cheers: boolean;
  showFamily: boolean;

  tick: () => void;
  setAsleep: (asleep: boolean) => void;
  earnTreat: (n?: number) => void;
  /** Eat one treat if there is one */
  feed: () => boolean;
  /** Returns how she took it */
  pet: () => 'purr' | 'annoyed';
  rename: (name: string) => void;
  renameKitten: (id: string, name: string) => void;
  setSkin: (skin: SkinId) => void;
  set: (patch: Partial<Pick<CatState, 'purrs' | 'cheers' | 'showFamily'>>) => void;
  onSessionDone: (minutes: number) => void;
  onSessionEarly: () => void;
  /** A snack or a toy from the care card: nudges her needs; meals add a little bond (capped per day) */
  treat: (fx: { hunger?: number; joy?: number; energy?: number; affection?: number; xp?: number }) => void;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const HOUR = 3_600_000;
let recentPets: number[] = [];
let petXpToday = { day: '', n: 0 };
let treatXpToday = { day: '', n: 0 };
let countedAt = 0;
/** start time of the most recently logged focus session */
const lastSessionAt = () => useData.getState().data.sessionLog?.at(-1)?.at ?? 0;

/* ------------------------------------------------------------------ */
/* Bond levels & the family journey                                     */
/* ------------------------------------------------------------------ */
const LEVELS = [0, 30, 80, 150, 240, 350, 480, 640, 830, 1050];
export const MAX_LEVEL = LEVELS.length;
export const levelOf = (xp: number) => LEVELS.filter((t) => xp >= t).length;
/** Progress (0-1) towards the next level, and the xp it needs */
export function levelProgress(xp: number) {
  const lv = levelOf(xp);
  if (lv >= MAX_LEVEL) return { pct: 1, need: 0 };
  return { pct: (xp - LEVELS[lv - 1]) / (LEVELS[lv] - LEVELS[lv - 1]), need: LEVELS[lv] - xp };
}
export const MILESTONES = { partner: 3, expecting: 4, kitten3: 6, kitten4: 8 } as const;
const BIRTH_AFTER = 3; // sessions after she starts expecting
const PARTNERS = ['Mochi', 'Biscuit', 'Pumpkin', 'Oreo', 'Leo', 'Simba', 'Milo', 'Tofu', 'Nugget', 'Ziggy'];
const KITTEN_NAMES = ['Bean', 'Pebble', 'Sprout', 'Button', 'Muffin', 'Peanut', 'Pickle', 'Noodle', 'Dumpling', 'Kiwi', 'Toffee', 'Boba', 'Cookie', 'Pudding', 'Waffle', 'Mango'];

export function unlocked(skin: SkinId, xp: number) {
  const s = skinOf(skin);
  return !s.unlock || levelOf(xp) >= s.unlock;
}

/** What's next on her journey, for the hover card and Settings */
export function nextMilestone(s: Pick<CatState, 'xp' | 'stage' | 'together' | 'expectingAt' | 'kittens'>): string | null {
  const lv = levelOf(s.xp);
  if (s.stage === 'single') return `💌 Someone special at bond level ${MILESTONES.partner}`;
  if (s.stage === 'dating') return `🍼 Big news at bond level ${MILESTONES.expecting}`;
  if (s.stage === 'expecting') return `🍼 Kittens in ${Math.max(1, BIRTH_AFTER - (s.together - s.expectingAt))} more focus session${BIRTH_AFTER - (s.together - s.expectingAt) === 1 ? '' : 's'}!`;
  if (s.kittens.length < 3) return `🐾 Another kitten at bond level ${MILESTONES.kitten3}`;
  if (s.kittens.length < 4) return `🐾 One more kitten at bond level ${MILESTONES.kitten4}`;
  return lv < MAX_LEVEL ? `💖 Max bond at level ${MAX_LEVEL}` : null;
}

function makeKitten(s: CatState, taken: string[]): Kitten {
  const free = SKINS.filter((k) => !k.unlock).map((k) => k.id);
  const r = Math.random();
  const skin = r < 0.45 ? s.skin : r < 0.9 && s.partner ? s.partner.skin : pick(free);
  const names = KITTEN_NAMES.filter((n) => !taken.includes(n));
  return { id: Math.random().toString(36).slice(2, 9), name: pick(names.length ? names : KITTEN_NAMES), skin, born: Date.now() };
}

export const useCat = create<CatState>()(
  persist(
    (set, get) => {
      /** Add bond points and walk the family journey forward; every step is announced on the bus */
      const grow = (xp: number) => {
        const s = get();
        const before = levelOf(s.xp);
        const after = levelOf(s.xp + xp);
        set({ xp: s.xp + xp });
        if (after > before) {
          bus.emit('cat:event', { kind: 'level', level: after });
          const skin = SKINS.find((k) => k.unlock === after);
          if (skin) toast({ emoji: '✨', title: `New skin unlocked: ${skin.name}`, body: 'Try it in Settings → Your cat' });
        }
        const now = get();
        if (now.stage === 'single' && after >= MILESTONES.partner) {
          const partner = { name: pick(PARTNERS.filter((p) => p !== now.name)), skin: pick(SKINS.filter((k) => !k.unlock && k.id !== now.skin)).id };
          set({ stage: 'dating', partner });
          bus.emit('cat:event', { kind: 'partner', names: [partner.name] });
          toast({ emoji: '💌', title: `${now.name} met ${partner.name}!`, body: 'Someone special drops by now and then.' });
        } else if (now.stage === 'dating' && after >= MILESTONES.expecting) {
          set({ stage: 'expecting', expectingAt: now.together });
          bus.emit('cat:event', { kind: 'expecting' });
          toast({ emoji: '🍼', title: `${now.name} is expecting!`, body: `Kittens arrive after ${BIRTH_AFTER} more focus sessions.` });
        } else if (now.stage === 'family') {
          const want = 2 + (after >= MILESTONES.kitten3 ? 1 : 0) + (after >= MILESTONES.kitten4 ? 1 : 0);
          if (now.kittens.length < want) {
            const k = makeKitten(now, now.kittens.map((x) => x.name));
            set({ kittens: [...now.kittens, k] });
            bus.emit('cat:event', { kind: 'kitten', names: [k.name] });
            toast({ emoji: '🐾', title: `A new kitten: ${k.name}!`, body: `${now.name}'s family keeps growing.` });
          }
        }
      };

      return {
        name: 'Flowy',
        skin: 'tabby',
        hunger: 30,
        energy: 80,
        joy: 70,
        affection: 40,
        treats: 1,
        asleep: false,
        annoyedUntil: 0,
        lastTick: Date.now(),
        xp: 0,
        together: 0,
        stage: 'single',
        partner: null,
        expectingAt: 0,
        kittens: [],
        purrs: true,
        cheers: true,
        showFamily: true,

        tick: () => {
          const now = Date.now();
          const h = Math.min(48, (now - get().lastTick) / HOUR);
          if (h <= 0) return;
          const s = get();
          set({
            lastTick: now,
            hunger: clamp(s.hunger + 9 * h),
            energy: clamp(s.energy + (s.asleep ? 45 : -7) * h),
            // joy drifts toward a mood set by how fed and loved she is
            joy: clamp(s.joy + ((s.hunger > 75 ? 25 : 55 + s.affection / 4) - s.joy) * Math.min(1, 0.25 * h)),
            affection: clamp(s.affection - 0.6 * h),
          });
        },
        setAsleep: (asleep) => get().asleep !== asleep && set({ asleep }),
        earnTreat: (n = 1) => set((s) => ({ treats: Math.min(9, s.treats + n), joy: clamp(s.joy + 4) })),
        feed: () => {
          const s = get();
          if (s.treats <= 0) return false;
          set({ treats: s.treats - 1, hunger: clamp(s.hunger - 45), joy: clamp(s.joy + 12), affection: clamp(s.affection + 2) });
          grow(3);
          return true;
        },
        pet: () => {
          const now = Date.now();
          recentPets = [...recentPets.filter((t) => now - t < 8000), now];
          if (recentPets.length >= 7 || now < get().annoyedUntil) {
            recentPets = [];
            set((s) => ({ annoyedUntil: now + 12_000, joy: clamp(s.joy - 6) }));
            return 'annoyed';
          }
          set((s) => ({ affection: clamp(s.affection + 2), joy: clamp(s.joy + 3), asleep: false }));
          // pets count toward the bond, a little, up to 15 a day
          const day = new Date().toDateString();
          if (petXpToday.day !== day) petXpToday = { day, n: 0 };
          if (petXpToday.n++ < 15) grow(1);
          return 'purr';
        },
        rename: (name) => set({ name: name.trim().slice(0, 20) || 'Flowy' }),
        renameKitten: (id, name) => set((s) => ({ kittens: s.kittens.map((k) => (k.id === id ? { ...k, name: name.trim().slice(0, 16) || k.name } : k)) })),
        setSkin: (skin) => unlocked(skin, get().xp) && set({ skin }),
        set: (patch) => set(patch),
        onSessionDone: (minutes) => {
          // one session counts once, whoever hears about it first (CatWorld, the Cat's Home, life.ts)
          const at = lastSessionAt();
          if (at && at === countedAt) return;
          countedAt = at;
          set((s) => ({ joy: clamp(s.joy + 15), affection: clamp(s.affection + 3), treats: Math.min(9, s.treats + 1), together: s.together + 1 }));
          grow(minutes >= 20 ? 12 : 8);
          const s = get();
          if (s.stage === 'expecting' && s.together - s.expectingAt >= BIRTH_AFTER) {
            const a = makeKitten(s, []);
            const b = makeKitten(s, [a.name]);
            set({ stage: 'family', kittens: [a, b] });
            bus.emit('cat:event', { kind: 'born', names: [a.name, b.name] });
            toast({ emoji: '🐱', title: `Kittens! Meet ${a.name} & ${b.name}`, body: 'Rename them in Settings → Your cat.' });
          }
        },
        // ending early makes her a little wistful, never punished: a small dip that drifts back
        onSessionEarly: () => {
          const at = lastSessionAt();
          if (at && at === countedAt) return;
          countedAt = at;
          set((s) => ({ joy: clamp(s.joy - 3) }));
        },
        treat: (fx) => {
          set((s) => ({
            hunger: clamp(s.hunger - (fx.hunger ?? 0)),
            joy: clamp(s.joy + (fx.joy ?? 0)),
            energy: clamp(s.energy + (fx.energy ?? 0)),
            affection: clamp(s.affection + (fx.affection ?? 1)),
            asleep: false,
          }));
          const day = new Date().toDateString();
          if (treatXpToday.day !== day) treatXpToday = { day, n: 0 };
          const xp = Math.min(fx.xp ?? 0, Math.max(0, 10 - treatXpToday.n));
          treatXpToday.n += xp;
          if (xp > 0) grow(xp);
        },
      };
    },
    {
      name: 'floww:cat',
      version: 1,
      partialize: (s) => ({
        name: s.name,
        skin: s.skin,
        hunger: s.hunger,
        energy: s.energy,
        joy: s.joy,
        affection: s.affection,
        treats: s.treats,
        asleep: s.asleep,
        annoyedUntil: s.annoyedUntil,
        lastTick: s.lastTick,
        xp: s.xp,
        together: s.together,
        stage: s.stage,
        partner: s.partner,
        expectingAt: s.expectingAt,
        kittens: s.kittens,
        purrs: s.purrs,
        cheers: s.cheers,
        showFamily: s.showFamily,
      }),
    },
  ),
);

/** Strongest feeling first. */
export function moodOf(s: CatNeeds & { annoyedUntil: number }): CatMood {
  if (Date.now() < s.annoyedUntil) return 'annoyed';
  if (s.energy < 22) return 'sleepy';
  if (s.hunger > 72) return 'hungry';
  if (s.joy < 30) return 'sad';
  if (s.affection > 80 && s.joy > 70) return 'loved';
  if (s.energy > 70 && s.joy > 60) return 'playful';
  if (s.joy > 60) return 'happy';
  return 'content';
}

export const MOOD_FACE: Record<CatMood, string> = {
  annoyed: '😾',
  sleepy: '😪',
  hungry: '🍗',
  sad: '😿',
  loved: '😻',
  playful: '😸',
  happy: '😺',
  content: '😌',
};

/* ------------------------------------------------------------------ */
/* Cat sounds (separate from meme sounds so they never cut each other)  */
/* ------------------------------------------------------------------ */
/** Just two soft sounds: a meow and a purr. Kittens use the same meow, higher and quieter. */
export type CatSfx = 'meow' | 'purr';
let lastSound = 0;

/** Plays a real cat sound, gently and rarely. Muted with the app's sounds. */
export function catSound(kind: CatSfx, volume = 0.2, kitten = false) {
  if (useData.getState().data.settings.soundProfile === 'off') return;
  const now = Date.now();
  if (now - lastSound < 5000) return; // never chatty
  lastSound = now;
  try {
    const a = new Audio(`/sounds/cat/${kind}.mp3`);
    a.volume = Math.min(0.3, kitten ? volume * 0.7 : volume);
    if (kitten) {
      a.preservesPitch = false;
      a.playbackRate = 1.4;
    }
    void a.play().catch(() => {});
  } catch {
    /* audio blocked */
  }
}
