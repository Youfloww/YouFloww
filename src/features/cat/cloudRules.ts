/**
 * The rules for keeping one cat per account across devices (pure, so they can be tested without Firebase or React).
 *
 * The cat is saved in the account as `data.cat`. Two devices can disagree; they are merged in three parts:
 * - progress (bond xp, sessions together, partner, kittens): the further-along cat wins, so nothing is ever lost;
 * - who she is (name, skin, treats, sounds): the most recent change wins (`idAt`);
 * - how she feels (hunger, energy, joy, affection, asleep): the most recently updated device wins (`needsAt`).
 */
import type { FamilyStage, Kitten } from './brain';
import type { SkinId } from './skins';

export interface CatSave {
  v: 1;
  /** last change to name / skin / treats / sound settings */
  idAt: number;
  /** last change to her needs */
  needsAt: number;
  name: string;
  skin: SkinId;
  treats: number;
  purrs: boolean;
  cheers: boolean;
  showFamily: boolean;
  hunger: number;
  energy: number;
  joy: number;
  affection: number;
  asleep: boolean;
  lastTick: number;
  xp: number;
  together: number;
  stage: FamilyStage;
  partner: { name: string; skin: SkinId } | null;
  expectingAt: number;
  kittens: Kitten[];
}

/** The parts of the cat's live state that are saved (the brain store has these fields and more). */
export type CatFields = Omit<CatSave, 'v' | 'idAt' | 'needsAt'>;

export const ID_FIELDS = ['name', 'skin', 'treats', 'purrs', 'cheers', 'showFamily'] as const;
export const NEED_FIELDS = ['hunger', 'energy', 'joy', 'affection', 'asleep', 'lastTick'] as const;
export const PROGRESS_FIELDS = ['xp', 'together', 'stage', 'partner', 'expectingAt', 'kittens'] as const;

const STAGE_RANK: Record<FamilyStage, number> = { single: 0, dating: 1, expecting: 2, family: 3 };

/** A save of the given state, fields always in the same order (so two saves compare as text). */
export function toSave(s: CatFields, idAt: number, needsAt: number): CatSave {
  return {
    v: 1,
    idAt,
    needsAt,
    name: s.name,
    skin: s.skin,
    treats: s.treats,
    purrs: s.purrs,
    cheers: s.cheers,
    showFamily: s.showFamily,
    hunger: s.hunger,
    energy: s.energy,
    joy: s.joy,
    affection: s.affection,
    asleep: s.asleep,
    lastTick: s.lastTick,
    xp: s.xp,
    together: s.together,
    stage: s.stage,
    partner: s.partner ? { name: s.partner.name, skin: s.partner.skin } : null,
    expectingAt: s.expectingAt,
    kittens: (s.kittens ?? []).map((k) => ({ id: k.id, name: k.name, skin: k.skin, born: k.born })),
  };
}

/** A stored value is a usable save (an old or broken one is ignored, never applied). */
export function isSave(x: unknown): x is CatSave {
  const s = x as CatSave | null;
  return !!s && typeof s === 'object' && s.v === 1 && typeof s.name === 'string' && Number.isFinite(s.xp) && Array.isArray(s.kittens);
}

const pickFields = <K extends keyof CatSave>(s: CatSave, keys: readonly K[]) => keys.map((k) => s[k]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Same cat, ignoring when each part was last touched. */
export function sameCat(a: CatSave | null, b: CatSave | null): boolean {
  if (!a || !b) return a === b;
  return same(pickFields(a, ID_FIELDS), pickFields(b, ID_FIELDS)) && same(pickFields(a, NEED_FIELDS), pickFields(b, NEED_FIELDS)) && same(pickFields(a, PROGRESS_FIELDS), pickFields(b, PROGRESS_FIELDS));
}

/** Changes worth saving right away (her name, her look, a level, a kitten); needs drift all the time and wait. */
export function importantChange(a: CatSave | null, b: CatSave | null): boolean {
  if (!a || !b) return a !== b;
  return !same(pickFields(a, ID_FIELDS), pickFields(b, ID_FIELDS)) || !same(pickFields(a, PROGRESS_FIELDS), pickFields(b, PROGRESS_FIELDS));
}

/** How far along a cat is: bond first, then time together, family stage, kittens. */
function further(a: CatSave, b: CatSave): CatSave {
  const ka = [a.xp, a.together, STAGE_RANK[a.stage] ?? 0, a.kittens.length];
  const kb = [b.xp, b.together, STAGE_RANK[b.stage] ?? 0, b.kittens.length];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] > kb[i] ? a : b;
  return a.idAt >= b.idAt ? a : b;
}

/**
 * One cat out of two. `canWear(skin, xp)` says whether a skin is unlocked at that bond (a newer skin choice
 * from a less advanced device is still kept when the merged bond allows it).
 */
export function mergeCat(local: CatSave | null, remote: CatSave | null, canWear: (skin: SkinId, xp: number) => boolean = () => true): CatSave | null {
  if (!local) return remote;
  if (!remote) return local;
  const prog = further(local, remote);
  const id = local.idAt >= remote.idAt ? local : remote;
  const needs = local.needsAt >= remote.needsAt ? local : remote;
  const out: CatSave = {
    v: 1,
    idAt: Math.max(local.idAt, remote.idAt),
    needsAt: Math.max(local.needsAt, remote.needsAt),
    name: id.name,
    skin: canWear(id.skin, prog.xp) ? id.skin : prog.skin,
    treats: id.treats,
    purrs: id.purrs,
    cheers: id.cheers,
    showFamily: id.showFamily,
    hunger: needs.hunger,
    energy: needs.energy,
    joy: needs.joy,
    affection: needs.affection,
    asleep: needs.asleep,
    lastTick: needs.lastTick,
    xp: prog.xp,
    together: prog.together,
    stage: prog.stage,
    partner: prog.partner,
    expectingAt: prog.expectingAt,
    kittens: prog.kittens,
  };
  return toSave(out, out.idAt, out.needsAt);
}

/** A cat nobody has touched yet on this browser (first visit): it must never override an account's real cat. */
export function isNewCat(s: CatFields): boolean {
  return s.xp === 0 && s.together === 0 && s.stage === 'single' && s.kittens.length === 0 && s.name === 'Flowy';
}
