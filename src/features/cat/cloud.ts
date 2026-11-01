/**
 * The cat follows the account. Her saved self lives in the user's data as `data.cat` (synced like the garden and
 * the Cat's Home); this keeps the live cat (useCat, also cached on this device) and that copy in step:
 * - this device changes her: the change is written to `data.cat` (name, look, levels and kittens soon; needs drift
 *   and are written at most every few minutes);
 * - the account's copy changes (another device, or signing in): it is merged in (cloudRules: progress never goes
 *   back, the latest rename or skin wins, the freshest needs win);
 * - a brand-new browser's default cat never overrides a real one, and signing into a different account on the same
 *   browser takes that account's cat instead of mixing two cats.
 */
import { useData } from '@/store/data';
import { isCloudReady } from '@/services/cloudReady';
import { useCat, unlocked } from './brain';
import { importantChange, isNewCat, isSave, mergeCat, sameCat, toSave, ID_FIELDS, NEED_FIELDS, type CatFields, type CatSave } from './cloudRules';

const KEY = 'cat';
const META = 'floww:catSync';
const NEEDS_EVERY = 5 * 60_000;

interface Meta {
  /** the account (uid) this browser's cat belongs to; 'guest' before any sign-in */
  owner: string;
  idAt: number;
  needsAt: number;
}

function readMeta(): Meta | null {
  try {
    const m = JSON.parse(localStorage.getItem(META) || 'null');
    return m && typeof m.owner === 'string' ? m : null;
  } catch {
    return null;
  }
}
function saveMeta() {
  try {
    localStorage.setItem(META, JSON.stringify(meta));
  } catch {
    /* private mode: the cat still syncs this visit */
  }
}

let meta: Meta = { owner: 'guest', idAt: 0, needsAt: 0 };
/** this browser's cat has never been touched: any saved cat replaces it */
let fresh = false;
let applying = false;
let seen: unknown = undefined;
let seenSig = '';
let lastWrite = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const canWear = (skin: Parameters<typeof unlocked>[0], xp: number) => unlocked(skin, xp);
const fields = (): CatFields => useCat.getState();
const mine = (): CatSave => toSave(fields(), meta.idAt, meta.needsAt);

/** Put a save into the live cat without it counting as a change made here. */
function apply(s: CatSave) {
  applying = true;
  try {
    useCat.setState({
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
      partner: s.partner,
      expectingAt: s.expectingAt,
      kittens: s.kittens,
    });
  } finally {
    applying = false;
  }
  meta.idAt = s.idAt;
  meta.needsAt = s.needsAt;
  fresh = false;
  saveMeta();
}

/** Write the live cat into the account's data (only once this device has heard from the server). */
function write(force = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (fresh) return;
  if (!isCloudReady() && useData.getState().user) {
    timer = setTimeout(() => write(force), 2000);
    return;
  }
  const cur = useData.getState().data[KEY];
  const stored = isSave(cur) ? cur : null;
  let next = mine();
  if (stored) {
    // never save a cat that is behind the account's copy: merge first (and show the merged cat here too)
    const merged = mergeCat(next, stored, canWear)!;
    if (!sameCat(merged, next)) {
      apply(merged);
      next = mine();
    }
  }
  if (stored && sameCat(stored, next)) return;
  if (!force && stored && !importantChange(stored, next) && Date.now() - lastWrite < NEEDS_EVERY) {
    timer = setTimeout(() => write(true), NEEDS_EVERY - (Date.now() - lastWrite));
    return;
  }
  lastWrite = Date.now();
  seen = next;
  useData.getState().mutate((d) => {
    d[KEY] = next;
  });
}

/** This browser's cat now belongs to this account (a guest's cat moves into the account it signs into). */
function claim(uid: string | null) {
  if (!uid || meta.owner === uid) return;
  meta.owner = uid;
  saveMeta();
}

function onCat(s: CatFields, prev: CatFields) {
  if (applying) return;
  const now = Date.now();
  const changed = (keys: readonly (keyof CatFields)[]) => keys.some((k) => JSON.stringify(s[k]) !== JSON.stringify(prev[k]));
  if (changed(ID_FIELDS)) meta.idAt = now;
  if (changed(NEED_FIELDS)) meta.needsAt = now;
  if (fresh && !isNewCat(s)) fresh = false; // she did something here (a session, a treat): she's real now
  saveMeta();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => write(), 1500);
}

function onData() {
  const { data, user } = useData.getState();
  const cur = data[KEY];
  const uid = user?.uid ?? null;
  const ready = !uid || isCloudReady();
  const sig = `${uid}|${ready}`;
  if (cur === seen && sig === seenSig) return;
  seen = cur;
  seenSig = sig;
  const remote = isSave(cur) ? cur : null;
  // a different account on this browser: its cat, never a mix of two people's cats
  const otherAccount = !!uid && meta.owner !== 'guest' && meta.owner !== uid;
  if (!remote) {
    if (!ready) return; // signed in, but the account's copy hasn't come from the server yet
    if (otherAccount) {
      // that account has no cat yet: it starts with a new one
      const now = Date.now();
      apply(toSave({ ...useCat.getInitialState(), lastTick: now }, now, now));
      fresh = true;
    }
    claim(uid);
    write(true); // this account has no cat saved yet (or a guest): save this one
    return;
  }
  if (otherAccount || fresh) {
    apply(remote);
    if (ready) claim(uid);
    return;
  }
  if (ready) claim(uid);
  const merged = mergeCat(mine(), remote, canWear)!;
  if (!sameCat(merged, mine())) apply(merged);
  else {
    meta.idAt = merged.idAt;
    meta.needsAt = merged.needsAt;
    saveMeta();
  }
  if (!sameCat(merged, remote)) write(true);
}

export function startCatCloud() {
  if (started) return;
  started = true;
  const m = readMeta();
  const s = fields();
  if (m) meta = m;
  else {
    // the first run with cloud saves: a cat already living here keeps her history; an untouched one is "fresh"
    meta = { owner: 'guest', idAt: s.lastTick || 0, needsAt: s.lastTick || 0 };
    saveMeta();
  }
  fresh = isNewCat(s) && (!m || (m.idAt === 0 && m.needsAt === 0));
  useCat.subscribe(onCat);
  useData.subscribe(onData);
  onData();
}
