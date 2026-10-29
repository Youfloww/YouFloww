import { pick } from '@/lib/utils';
import { catSound, moodOf, useCat, type CatSfx } from './brain';
import { CARE, CHEER, KITTEN, PLAY, BEG, SAD, FED, ANNOYED } from './lines';
import { Body, Thing, circleOf, clamp, floorY, ledges, nearAngle, normAngle, rand, type Ground } from './world';

/**
 * What the cats decide to do. Each action is an async story told with Body moves; any move resolves
 * false when something more important interrupts her (a pet, a session starting…), and the action
 * simply stops there.
 */
export type ParticleKind = 'float' | 'z' | 'drop' | 'note' | 'spark';
export type ThingKind = 'bowl' | 'yarn' | 'boxBack' | 'boxFront' | 'item' | 'gift' | 'butterfly';

export interface Ctx {
  mom: Body;
  kittens: () => Body[];
  partner: () => Body | null;
  orb: () => Element | null;
  say: (b: Body, text: string, ms?: number) => void;
  emote: (b: Body, emoji: string, ms?: number) => void;
  burst: (b: Body, items: string[], kind?: ParticleKind) => void;
  show: (kind: ThingKind, x: number, y: number, emoji?: string) => Thing;
  hide: (kind: ThingKind) => void;
  thing: (kind: ThingKind) => Thing | null;
  tint: (b: Body, t: 'sad' | 'mad' | null) => void;
  cloud: (b: Body, on: boolean) => void;
  pointer: { x: number; y: number; at: number };
  focus: () => boolean;
  /** a focus session is on the clock (running or paused): her study corner is out */
  studying: () => boolean;
  /** where her desk stands (floor x) */
  nookX: () => number;
  breakTime: () => boolean;
  music: () => boolean;
  reduced: () => boolean;
}
type Act = (c: Ctx, b: Body, tok: number) => Promise<void>;

const deg = Math.PI / 180;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function choose<T>(w: [T, number][]): T {
  const live = w.filter(([, n]) => n > 0);
  let r = Math.random() * live.reduce((a, [, n]) => a + n, 0);
  for (const [k, n] of live) if ((r -= n) <= 0) return k;
  return live[live.length - 1]?.[0] ?? w[0][0];
}
export const isKitten = (b: Body) => b.id.startsWith('k:');
export function sound(b: Body, kind: CatSfx, vol = 0.2) {
  catSound(kind, vol, isKitten(b));
}

/* ------------------------------------------------------------------ */
/* Getting around                                                       */
/* ------------------------------------------------------------------ */
/** Angles on the ring's shoulders: off the very top, so she never covers the mode tabs */
export const SHOULDERS = [-140, -40];
const onOrb = (b: Body, c: Ctx) => b.ground.kind === 'orb' && b.ground.el === c.orb();

export async function toFloor(_c: Ctx, b: Body) {
  if (b.ground.kind === 'floor') return true;
  if (b.ground.kind === 'orb') {
    const right = Math.cos(b.angle * deg) >= 0;
    return b.jump({ kind: 'floor' }, b.x + (right ? 1 : -1) * rand(40, 90));
  }
  return b.jump({ kind: 'floor' }, b.x + rand(-80, 80));
}

/** Onto the timer ring at an angle: a straight leap, or a climb up its side */
export async function toOrb(c: Ctx, b: Body, angle: number, climb = Math.random() < 0.55) {
  const el = c.orb();
  const circ = circleOf(el);
  if (!el || !circ) return false;
  if (onOrb(b, c)) return b.arc(nearAngle(angle, b.angle), 70);
  if (b.ground.kind !== 'floor' && !(await toFloor(c, b))) return false;
  const right = Math.cos(angle * deg) >= 0;
  if (climb && !c.reduced()) {
    // walk to the ring's side, hop onto it sideways and walk up the curve
    const side = right ? -6 : -174;
    const foot = circ.cx + (right ? 1 : -1) * (circ.r + b.W * 0.3);
    if (!(await (Math.abs(foot - b.x) > 260 ? b.run(foot) : b.walk(foot, 95)))) return false;
    if (!(await b.jump({ kind: 'orb', el }, side, { height: 34 }))) return false;
    b.face('star');
    const ok = await b.arc(nearAngle(angle, b.angle), 60);
    b.face('normal');
    return ok;
  }
  const px = circ.cx + circ.r * Math.cos(angle * deg);
  if (Math.abs(b.x - px) > 260 && !(await b.walk(px + (b.x < px ? -140 : 140), 110))) return false;
  return b.jump({ kind: 'orb', el }, angle);
}

/** A floor spot off to the sides, where she isn't standing in front of the timer's buttons */
export function sideSpot(b: Body, near = b.x) {
  const mid = innerWidth / 2;
  const keep = Math.min(300, innerWidth * 0.22);
  let x = clamp(near + rand(-1, 1) * rand(120, innerWidth * 0.45), b.foot, innerWidth - b.foot);
  if (Math.abs(x - mid) < keep && Math.random() < 0.8) x = mid + Math.sign(x - mid || 1) * rand(keep, keep + 220);
  return clamp(x, b.foot, innerWidth - b.foot);
}

/** Wherever: same surface = walk, else jump (via the floor when needed) */
async function wanderOn(c: Ctx, b: Body) {
  if (onOrb(b, c)) return b.arc(nearAngle(pick([-150, -120, -90, -60, -30]), b.angle), 60);
  if (b.ground.kind === 'ledge') {
    const l = b.ledge(b.ground.el);
    if (l && Math.random() < 0.7) return b.walk(rand(l.minX, l.maxX));
    return toFloor(c, b);
  }
  return b.walk(sideSpot(b), rand(70, 95));
}

async function sit(b: Body, ms: number) {
  b.anim('slide', { frame: 9 });
  return b.wait(ms);
}

export async function nap(c: Ctx, b: Body, ms: number) {
  if (b.id === 'mom') useCat.getState().setAsleep(true);
  b.anim('slide', { frame: 3 });
  b.face('normal');
  const end = Date.now() + ms;
  let ok = true;
  while (Date.now() < end) {
    c.burst(b, [pick(['z', 'Z', 'z'])], 'z');
    if (!(ok = await b.wait(1900))) break;
  }
  if (b.id === 'mom') useCat.getState().setAsleep(false);
  return ok;
}

/* ------------------------------------------------------------------ */
/* Mom's repertoire                                                     */
/* ------------------------------------------------------------------ */
const wander: Act = async (c, b) => {
  await wanderOn(c, b);
};

const zoomies: Act = async (c, b, tok) => {
  if (c.reduced()) return void c.emote(b, '⚡');
  if (!(await toFloor(c, b))) return;
  if (Math.random() < 0.5) c.say(b, pick(PLAY.zoomies), 1800);
  for (let i = 0; i < 4 && b.alive(tok); i++) {
    c.emote(b, i % 2 ? '💨' : '⚡', 900);
    const left = b.x > innerWidth / 2;
    if (!(await b.run(left ? rand(b.foot, innerWidth * 0.3) : rand(innerWidth * 0.7, innerWidth - b.foot)))) return;
    if (Math.random() < 0.4 && !(await b.hop(40))) return;
  }
  b.face('happy');
  c.emote(b, '💦');
  await b.wait(1400);
  b.face('normal');
};

const perch: Act = async (c, b) => {
  const spots = ledges().filter((el) => b.ledge(el));
  if (!spots.length) return wander(c, b, 0);
  const el = pick(spots);
  const l = b.ledge(el)!;
  if (b.ground.kind === 'orb' || (b.ground.kind === 'ledge' && b.ground.el !== el)) if (!(await toFloor(c, b))) return;
  const x = rand(l.minX, l.maxX);
  if (Math.abs(b.x - x) > 300 && !(await b.walk(x + (b.x < x ? -160 : 160), 100))) return;
  if (!(await b.jump({ kind: 'ledge', el }, x))) return;
  b.flip = Math.random() < 0.5;
  if (!(await sit(b, rand(4000, 9000)))) return;
};

const orbClimb: Act = async (c, b) => {
  const a = pick([-150, -128, -52, -30]);
  if (!(await toOrb(c, b, a))) return;
  if (Math.random() < 0.35) c.say(b, pick(PLAY.orb), 2200);
  if (Math.random() < 0.5) {
    if (!(await sit(b, rand(3000, 7000)))) return;
  } else if (!(await b.arc(nearAngle(pick(SHOULDERS), b.angle), 45))) return;
};

const orbLoop: Act = async (c, b, tok) => {
  if (c.reduced()) return;
  if (!onOrb(b, c) && !(await toOrb(c, b, pick(SHOULDERS), false))) return;
  c.say(b, pick(PLAY.orb), 2000);
  b.face('star');
  const dir = Math.random() < 0.5 ? 1 : -1;
  const ok = await b.arc(b.angle + dir * 360, 330, 'run');
  b.angle = normAngle(b.angle);
  b.face('normal');
  if (!ok || !b.alive(tok)) return;
  c.burst(b, ['✨', '⭐', '✨'], 'spark');
  await b.hop(26);
};

const curious: Act = async (c, b, tok) => {
  const p = c.pointer;
  if (onOrb(b, c) || b.ground.kind === 'ledge') if (!(await toFloor(c, b))) return;
  const stop = p.x >= b.x ? -b.W * 0.55 : b.W * 0.55;
  if (!(await b.walk(p.x + stop, 95))) return;
  b.flip = p.x < b.x;
  b.face('star');
  c.emote(b, pick(['❓', '👀']), 1400);
  const snap = { ...p };
  if (!(await b.wait(1300))) return;
  // the cursor sat still: pounce!
  if (Math.hypot(p.x - snap.x, p.y - snap.y) < 18 && !c.reduced() && b.alive(tok)) {
    await b.jump({ kind: 'floor' }, p.x, { height: 70 });
    c.emote(b, '🐾', 900);
  }
  b.face('normal');
};

const groom: Act = async (c, b) => {
  b.anim('idle');
  b.face('happy');
  b.bob = 'groom';
  c.emote(b, '👅', 1500);
  if (!(await b.wait(2600))) return;
  c.burst(b, ['✨'], 'spark');
  b.bob = 'breathe';
  b.face('normal');
  await b.wait(600);
};

const stretch: Act = async (c, b) => {
  b.face('happy');
  c.emote(b, '🥱', 1500);
  b.sy = 0.92;
  b.sx = 1.12;
  if (!(await b.wait(1300))) return;
  b.sx = b.sy = 1;
  b.face('normal');
  await sit(b, 2500);
};

const napAct: Act = async (c, b) => {
  if (!onOrb(b, c) && b.ground.kind === 'floor' && Math.random() < 0.6) if (!(await toOrb(c, b, pick(SHOULDERS)))) return;
  await nap(c, b, rand(20000, 45000));
};

/** Pop a food bowl next to her, eat a treat (or a snack from the care card, already paid for) */
export const eat: Act = async (c, b, tok) => {
  const st = useCat.getState();
  if (!st.feed()) return beg(c, b, tok);
  return munch(c, b, '🐟', FED);
};
export async function munch(c: Ctx, b: Body, emoji: string, lines: string[]) {
  if (b.ground.kind !== 'floor' && !(await toFloor(c, b))) return;
  const room = innerWidth - b.x > b.W;
  const bowl = c.show('bowl', b.x + (room ? 1 : -1) * b.W * 0.42, floorY(), emoji);
  b.flip = !room;
  b.anim('idle');
  b.face('happy');
  b.bob = 'eat';
  for (let i = 0; i < 6; i++) {
    c.burst(b, ['nom'], 'float');
    bowl.s = 1 - i * 0.02;
    if (!(await b.wait(520))) return void c.hide('bowl');
  }
  c.hide('bowl');
  b.bob = 'breathe';
  b.face('love');
  c.say(b, pick(lines), 2200);
  c.burst(b, ['💕', '❤️'], 'float');
  if (useCat.getState().purrs) sound(b, 'purr', 0.12);
  b.bob = 'purr';
  await b.wait(1800);
  b.bob = 'breathe';
  b.face('normal');
}

const beg: Act = async (c, b) => {
  if (b.ground.kind !== 'floor' && !(await toFloor(c, b))) return;
  if (!(await b.walk(sideSpot(b)))) return;
  b.face('sad');
  c.emote(b, '🍗');
  c.say(b, pick(BEG), 4200);
  sound(b, 'meow');
  await b.wait(3000);
  b.face('normal');
};

export const yarn: Act = async (c, b, tok) => {
  if (c.reduced()) return void c.emote(b, '🧶');
  if (!(await toFloor(c, b))) return;
  const y = floorY();
  const ball = c.show('yarn', clamp(b.x + (b.flip ? -80 : 80), 40, innerWidth - 40), y);
  for (let i = 0; i < 3 && b.alive(tok); i++) {
    const to = clamp(ball.x + (ball.x < innerWidth / 2 ? 1 : -1) * rand(140, 300), 40, innerWidth - 40);
    void ball.tween({ x: to, rot: ball.rot + (to - ball.x) * 2.5 }, 0.9, 'out');
    b.face('star');
    if (!(await b.run(to - Math.sign(to - b.x) * b.W * 0.35))) break;
    if (!(await b.jump({ kind: 'floor' }, to - Math.sign(to - b.x) * b.W * 0.15, { height: 55 }))) break;
  }
  c.hide('yarn');
  b.face('happy');
  c.emote(b, '😸');
  await b.wait(1200);
  b.face('normal');
};

const sad: Act = async (c, b) => {
  b.anim('idle');
  b.face('sad');
  c.tint(b, 'sad');
  c.cloud(b, true);
  c.say(b, pick(SAD), 3600);
  for (let i = 0; i < 6; i++) {
    c.burst(b, ['💧'], 'drop');
    if (!(await b.wait(600))) break;
  }
  c.cloud(b, false);
  c.tint(b, null);
  b.face('normal');
};

export const annoyed: Act = async (c, b) => {
  b.anim('idle');
  b.face('mad');
  c.tint(b, 'mad');
  c.emote(b, '💢');
  if (Math.random() < 0.6) c.say(b, pick(ANNOYED), 2400);
  b.jitter = 3;
  if (!(await b.wait(700))) return void c.tint(b, null);
  b.jitter = 0;
  if (b.ground.kind !== 'orb') await b.walk(b.x + (b.x >= c.pointer.x ? 1 : -1) * 180, 110);
  c.tint(b, null);
  b.face('normal');
};

export const happy: Act = async (c, b) => {
  b.face('love');
  c.emote(b, '😻');
  if (useCat.getState().purrs && Math.random() < 0.6) sound(b, 'purr');
  for (let i = 0; i < 3; i++) {
    c.burst(b, [i % 2 ? '💕' : '❤️'], 'float');
    if (!(await b.hop(24))) return;
    b.face('love');
  }
  await b.wait(500);
  b.face('normal');
};

const butterfly: Act = async (c, b, tok) => {
  if (!(await toFloor(c, b))) return;
  const fromLeft = Math.random() < 0.5;
  const fly = c.show('butterfly', fromLeft ? -30 : innerWidth + 30, innerHeight * rand(0.35, 0.55));
  c.say(b, pick(PLAY.butterfly), 2200);
  b.face('star');
  let ok = true;
  for (let i = 0; i < 4 && ok && b.alive(tok); i++) {
    const tx = clamp(b.x + rand(-1, 1) * rand(150, 380), 60, innerWidth - 60);
    const ty = floorY() - rand(b.H * 0.9, b.H * 1.8);
    const x0 = fly.x;
    const y0 = fly.y;
    void fly.path((t) => ({ x: x0 + (tx - x0) * t, y: y0 + (ty - y0) * t + Math.sin(t * Math.PI * 4) * 22, rot: Math.sin(t * Math.PI * 6) * 14 }), 1.3);
    ok = await b.run(tx - Math.sign(tx - b.x) * 30);
    if (ok) ok = await b.jump({ kind: 'floor' }, tx, { height: Math.min(170, floorY() - ty) });
  }
  // she never catches it
  const x1 = fly.x;
  const y1 = fly.y;
  void fly.path((t) => ({ x: x1 + (fromLeft ? 1 : -1) * t * innerWidth * 0.7, y: y1 - t * innerHeight * 0.6, rot: Math.sin(t * 20) * 14 }), 2.6).then(() => c.hide('butterfly'));
  b.face('normal');
  if (ok) {
    c.emote(b, '💭');
    await b.wait(1200);
  }
};

const box: Act = async (c, b, tok) => {
  if (!(await toFloor(c, b))) return;
  const x = clamp(b.x + (b.flip ? -1 : 1) * rand(160, 320), b.W, innerWidth - b.W);
  const y = floorY();
  const back = c.show('boxBack', x, y);
  const front = c.show('boxFront', x, y);
  back.s = front.s = 0.2;
  void back.tween({ s: 1 }, 0.35, 'out');
  void front.tween({ s: 1 }, 0.35, 'out');
  c.emote(b, '📦');
  if (!(await b.walk(x + (b.x < x ? -1 : 1) * b.W * 0.7, 100))) return void hideBox(c);
  if (!(await b.jump({ kind: 'floor' }, x, { height: 60 }))) return void hideBox(c);
  b.face('happy');
  c.say(b, pick(PLAY.box), 2600);
  if (useCat.getState().purrs) sound(b, 'purr', 0.16);
  b.bob = 'purr';
  const ok = await b.wait(rand(5000, 9000));
  b.bob = 'breathe';
  if (ok && b.alive(tok)) await b.jump({ kind: 'floor' }, x + (Math.random() < 0.5 ? -1 : 1) * b.W * 0.8, { height: 70 });
  b.face('normal');
  hideBox(c);
};
function hideBox(c: Ctx) {
  for (const k of ['boxBack', 'boxFront'] as const) {
    const t = c.thing(k);
    if (t) void t.tween({ s: 0.2, o: 0 }, 0.3, 'in').then(() => c.hide(k));
  }
}

/** The classic: push something off the edge while looking right at you */
const knock: Act = async (c, b, tok) => {
  const el = c.orb();
  const circ = circleOf(el);
  if (!circ) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  const a = side > 0 ? -38 : -142;
  const ix = circ.cx + circ.r * Math.cos(a * deg);
  const iy = circ.cy + circ.r * Math.sin(a * deg);
  const item = c.show('item', ix, iy + 4, pick(['☕', '🪴', '🥛', '✏️', '🧸', '🍩']));
  item.rot = side * 20;
  if (!(await toOrb(c, b, a - side * 18))) return void c.hide('item');
  b.flip = side < 0;
  if (!(await b.wait(700))) return void c.hide('item');
  b.flip = !b.flip; // look at you…
  b.face('mad');
  if (!(await b.wait(900))) return void c.hide('item');
  b.flip = side < 0;
  b.face('happy');
  if (!(await b.hop(12, 0.22))) return void c.hide('item');
  // …and push
  const fy = floorY();
  const x0 = item.x;
  const y0 = item.y;
  const dx = side * rand(60, 120);
  void item.path((t) => ({ x: x0 + dx * t, y: y0 - 40 * Math.sin(Math.min(1, t * 2.4) * Math.PI * 0.5) * (1 - t) + (fy - y0) * t * t, rot: side * 540 * t }), 0.9).then(async () => {
    await item.tween({ y: fy - 18 }, 0.12, 'out');
    await item.tween({ y: fy }, 0.14, 'in');
    await sleep(1600);
    await item.tween({ o: 0 }, 0.5);
    c.hide('item');
  });
  if (b.alive(tok)) {
    c.say(b, pick(PLAY.knock), 2400);
    await b.wait(1600);
  }
  b.face('normal');
};

const gift: Act = async (c, b) => {
  if (c.thing('gift')) return;
  if (!(await toFloor(c, b))) return;
  const x = sideSpot(b);
  if (!(await b.walk(x + (b.x < x ? -1 : 1) * b.W * 0.3, 100))) return;
  const g = c.show('gift', x, floorY(), pick(['🐭', '🧦', '🌸', '🍂', '🪶', '🎀']));
  g.s = 0.3;
  void g.tween({ s: 1 }, 0.3, 'out');
  b.face('love');
  c.say(b, pick(PLAY.gift), 3200);
  sound(b, 'meow');
  await b.wait(2400);
  b.face('normal');
};

const dance: Act = async (c, b, tok) => {
  if (b.ground.kind === 'air') return;
  c.say(b, pick(PLAY.dance), 2200);
  for (let i = 0; i < 8 && b.alive(tok) && c.music(); i++) {
    b.face(i % 4 === 3 ? 'star' : 'happy');
    c.burst(b, [pick(['🎵', '🎶'])], 'note');
    if (!(await b.hop(18, 0.3))) return;
    b.flip = !b.flip;
    if (!(await b.wait(160))) return;
  }
  b.face('normal');
};

const tailChase: Act = async (c, b) => {
  if (c.reduced() || b.ground.kind !== 'floor') return;
  c.say(b, PLAY.tail[0], 1600);
  if (!(await b.twirl(3, 1.6))) return;
  b.anim('hurt', { loop: false });
  c.emote(b, '💫');
  c.say(b, PLAY.tail[1], 1800);
  if (!(await b.wait(1100))) return;
  b.anim('idle');
};

const care: Act = async (c, b) => {
  b.face('happy');
  c.say(b, pick(CARE), 4200);
  await b.wait(3000);
  b.face('normal');
};

/** Pick mom's next thing to do */
export function chooseMom(c: Ctx, last: string[]): [string, Act] {
  const s = useCat.getState();
  const mood = moodOf(s);
  const kids = c.kittens().length;
  const weights: [string, number][] = [
    ['wander', 26],
    ['zoomies', mood === 'playful' && s.energy > 55 ? 14 : 2],
    ['perch', ledges().length ? 16 : 0],
    ['orbClimb', c.orb() ? 18 : 0],
    ['orbLoop', c.orb() && (mood === 'playful' || mood === 'happy') ? 9 : c.orb() ? 3 : 0],
    ['curious', Date.now() - c.pointer.at < 5000 ? 18 : 3],
    ['groom', 9],
    ['stretch', s.energy < 50 ? 10 : 3],
    ['nap', mood === 'sleepy' ? 40 : Math.max(0, (55 - s.energy) * 0.8)],
    ['eat', s.hunger > 60 ? 40 : s.treats > 0 && s.hunger > 30 ? 16 : 0],
    ['beg', s.hunger > 70 && s.treats === 0 ? 14 : 0],
    ['yarn', mood === 'playful' || mood === 'happy' || kids ? 12 : 4],
    ['sad', mood === 'sad' ? 30 : 0],
    ['annoyed', mood === 'annoyed' ? 40 : 0],
    ['happy', mood === 'loved' || mood === 'happy' ? 14 : 4],
    ['butterfly', 6],
    ['box', 6],
    ['knock', c.orb() ? 5 : 0],
    ['gift', s.affection > 50 ? 4 : 1],
    ['dance', c.music() ? 30 : 0],
    ['tail', 4],
    ['care', 2],
  ];
  // no repeats back to back
  for (const w of weights) if (last.slice(-2).includes(w[0])) w[1] *= w[0] === 'wander' ? 0.5 : 0;
  const k = choose(weights);
  return [k, ACTS[k]];
}

export const ACTS: Record<string, Act> = { wander, zoomies, perch, orbClimb, orbLoop, curious, groom, stretch, nap: napAct, eat, beg, yarn, sad, annoyed, happy, butterfly, box, knock, gift, dance, tail: tailChase, care };

/**
 * While you focus she works beside you: walks to her desk next to the timer and knits / reads / writes.
 * Her face drifts between concentrating, content and pleased; the desk and the project are drawn by CatWorld.
 */
export async function studyStep(c: Ctx, b: Body) {
  const x = c.nookX();
  if (b.ground.kind !== 'floor' && !(await toFloor(c, b))) return;
  if (Math.abs(b.x - x) > 3) {
    if (!(await (Math.abs(b.x - x) > 260 ? b.run(x) : b.walk(x, 95)))) return;
    b.flip = false;
    c.burst(b, ['✨'], 'spark');
  }
  b.flip = false;
  b.anim('idle');
  for (let i = 0; i < 12; i++) {
    if (!c.focus()) {
      // paused: she rests her paws and waits for you
      b.face('normal');
      if (!(await b.wait(1500))) return;
      continue;
    }
    const r = Math.random();
    b.face(r < 0.22 ? 'happy' : 'normal');
    if (!(await b.wait(rand(3500, 7000)))) return;
    if (r > 0.9) {
      b.face('star');
      c.burst(b, [pick(['✨', '💡', '🎶'])], 'spark');
      if (!(await b.wait(1100))) return;
    }
    // drift back to her spot if something nudged her
    if (Math.abs(b.x - c.nookX()) > 6) return;
  }
}

/** A pep talk now and then while you focus */
export function cheer(c: Ctx) {
  const b = c.mom;
  b.setView({ face: b.view.anim === 'slide' ? b.view.face : 'happy' });
  c.say(b, pick(CHEER), 5200);
  setTimeout(() => b.view.face === 'happy' && b.view.anim !== 'slide' && b.face('normal'), 2500);
}

/* ------------------------------------------------------------------ */
/* Kittens: stay near mom, play, tumble, nap in a heap                  */
/* ------------------------------------------------------------------ */
export async function kittenStep(c: Ctx, k: Body, tok: number) {
  const mom = c.mom;
  const sibs = c.kittens().filter((x) => x.id !== k.id);
  if (c.studying()) {
    // nap beside mom's desk while she works
    if (k.ground.kind !== 'floor' && !(await toFloor(c, k))) return;
    const side = k.x < c.nookX() ? -1 : 1;
    const spot = clamp(c.nookX() + side * rand(mom.W * 0.62, mom.W * 0.95), k.foot, innerWidth - k.foot);
    if (Math.abs(spot - k.x) > 30 && !(await k.walk(spot, 70))) return;
    k.flip = side > 0;
    await nap(c, k, rand(30000, 60000));
    return;
  }
  // a yarn ball is out: everybody chases it
  const ball = c.thing('yarn');
  if (ball && k.ground.kind === 'floor') {
    k.face('star');
    await k.run(ball.x + rand(-50, 50));
    await k.hop(26);
    k.face('normal');
    return;
  }
  const r = choose<string>([
    ['follow', 34],
    ['play', sibs.length ? 22 : 0],
    ['pounce', 12],
    ['tumble', 8],
    ['explore', 10],
    ['nap', mom.view.anim === 'slide' ? 30 : 6],
    ['mew', 8],
  ]);
  if (r === 'follow') {
    if (onOrb(mom, c)) {
      await toOrb(c, k, mom.angle + rand(-28, 28), Math.random() < 0.5);
      return;
    }
    if (k.ground.kind !== mom.ground.kind || (mom.ground.kind === 'ledge' && k.ground.kind === 'ledge' && k.ground.el !== mom.ground.el)) {
      if (mom.ground.kind === 'ledge') await k.jump(mom.ground as Ground, mom.x + rand(-50, 50));
      else await toFloor(c, k);
      return;
    }
    const tx = mom.x + (Math.random() < 0.5 ? -1 : 1) * rand(mom.W * 0.45, mom.W * 1.1);
    await (Math.abs(tx - k.x) > 200 ? k.run(tx) : k.walk(tx, 90));
  } else if (r === 'play') {
    const s = pick(sibs);
    if (k.ground.kind !== 'floor' || s.ground.kind !== 'floor') return void (await toFloor(c, k));
    await k.run(s.x + (k.x < s.x ? -1 : 1) * k.W * 0.4);
    if (!k.alive(tok)) return;
    k.face('star');
    c.burst(k, ['💥'], 'spark');
    await k.hop(30);
    k.face('normal');
  } else if (r === 'pounce') {
    if (k.ground.kind !== 'floor') return void (await toFloor(c, k));
    k.face('star');
    await k.jump({ kind: 'floor' }, k.x + (k.flip ? -1 : 1) * rand(30, 90), { height: 46 });
    k.face('normal');
  } else if (r === 'tumble') {
    k.anim('hurt', { loop: false });
    c.emote(k, '💫', 1000);
    await k.wait(900);
    k.anim('idle');
  } else if (r === 'explore') {
    if (Math.random() < 0.5 && c.orb()) await toOrb(c, k, pick([-160, -140, -40, -20]), Math.random() < 0.6);
    else await wanderOn(c, k);
  } else if (r === 'nap') {
    if (k.ground.kind === 'floor' && mom.ground.kind === 'floor') await k.walk(mom.x + (Math.random() < 0.5 ? -1 : 1) * mom.W * 0.5);
    await nap(c, k, rand(15000, 30000));
  } else {
    k.face('happy');
    c.say(k, pick(KITTEN), 1600);
    sound(k, 'meow');
    await k.wait(1400);
    k.face('normal');
  }
}

/** Her partner drops by: walks in, cuddles, leaves */
export async function partnerVisit(c: Ctx, p: Body, tok: number, name: string) {
  const mom = c.mom;
  const fromLeft = mom.x > innerWidth / 2;
  p.free = true;
  p.place({ kind: 'floor' }, fromLeft ? -p.W : innerWidth + p.W);
  const spot = clamp(mom.x + (fromLeft ? -1 : 1) * mom.W * 0.75, p.foot, innerWidth - p.foot);
  // trot in, slow down for the last bit
  if (!(await p.run(spot + (fromLeft ? -1 : 1) * 120))) return;
  if (!(await p.walk(spot, 90))) return;
  p.flip = !fromLeft;
  p.face('love');
  c.say(p, pick([`Hi ${useCat.getState().name}! 💕`, 'Mrrrow 💕', 'Missed you 😻']), 2600);
  sound(p, 'meow');
  c.burst(p, ['💕', '❤️'], 'float');
  for (let i = 0; i < 3 && p.alive(tok); i++) {
    if (!(await p.wait(rand(5000, 9000)))) return;
    c.burst(p, ['💕'], 'float');
  }
  void name;
  p.face('normal');
  await p.run(fromLeft ? -p.W * 2 : innerWidth + p.W * 2);
}
