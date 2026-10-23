import { FEET, SPRITE_ASPECT, type CatAnim, type CatFace } from './CatSprite';

/**
 * The cats' little physics world. Everything is measured in viewport pixels and refreshed every frame,
 * so a cat sitting on a window rides along when you drag it, and one walking around the timer ring
 * follows the orb as it floats.
 *
 * Grounds: the floor (just above the dock), window tops, and the timer orb (a circle she can sit on,
 * climb, or run all the way around).
 */
export type Ground = { kind: 'floor' } | { kind: 'ledge'; el: Element } | { kind: 'orb'; el: Element } | { kind: 'air' };

const deg = Math.PI / 180;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/* ------------------------------------------------------------------ */
/* Geometry                                                             */
/* ------------------------------------------------------------------ */
export function floorY() {
  const dock = document.querySelector('[data-cat-perch="dock"]')?.getBoundingClientRect();
  return dock && dock.height > 0 ? Math.min(innerHeight - 10, dock.top) : innerHeight - 14;
}
export const orbEl = () => document.querySelector('[data-cat-orb]');
/** The orb's ring as a circle: centre and the radius her feet stand on */
export function circleOf(el: Element | null) {
  if (!el?.isConnected) return null;
  const b = el.getBoundingClientRect();
  if (b.width < 60) return null;
  // the ring (r=92, 7px stroke in a 200 viewBox) ends 95.5/200 of the way out
  return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, r: b.width * 0.4775 };
}
/** The top edge of a window (or the task pill) as a place to stand; null when it's gone or too high to fit her */
export function ledgeOf(el: Element | null, footW: number, height: number) {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < footW * 2.2 || r.top < height * 0.7 || r.top > innerHeight - 60) return null;
  return { y: r.top, left: r.left, minX: r.left + footW, maxX: r.right - footW };
}
export const ledges = () => [...document.querySelectorAll('[data-cat-perch="window"], [data-cat-perch="ledge"]')];

/* ------------------------------------------------------------------ */
/* A cat body                                                           */
/* ------------------------------------------------------------------ */
type Motion = (dt: number, now: number) => boolean; // true when finished

export interface BodyView {
  anim: CatAnim;
  face: CatFace;
  /** hold one frame (sleeping loaf) */
  frame?: number;
  loop?: boolean;
  tint?: 'sad' | 'mad' | null;
}

export class Body {
  readonly id: string;
  H: number;
  W: number;
  x = 0;
  y = 0;
  rot = 0;
  flip = false;
  ground: Ground = { kind: 'floor' };
  /** degrees around the orb (-90 = top), unbounded so loops can go past 360 */
  angle = -90;
  /** x relative to the ledge's left edge, so she rides along with a dragged window */
  relX = 0;
  lift = 0;
  sx = 1;
  sy = 1;
  spin = 0;
  jitter = 0;
  /** head-bob for eating / grooming / purring */
  bob: 'none' | 'eat' | 'groom' | 'purr' | 'breathe' = 'breathe';
  view: BodyView = { anim: 'idle', face: 'normal' };
  dragging = false;
  /** may walk past the screen edges (a visitor arriving or leaving) */
  free = false;
  /** a reaction (petting, a session event) owns her right now; her own plans wait */
  reacting = false;
  reactSeq = 0;
  el: HTMLElement | null = null;
  token = 0;
  private motion: Motion | null = null;
  private done: ((ok: boolean) => void) | null = null;
  /** the current motion flies her itself (a jump); otherwise gravity owns her while she's in the air */
  private airborne = false;
  private vy = 0;
  private squashing = 0;
  private nextBlink = performance.now() + rand(2000, 5000);
  private blinkUntil = 0;
  private faceBeforeBlink: CatFace = 'normal';
  onView: (v: BodyView) => void = () => {};
  /** a ledge or the orb vanished under her */
  onLostGround: () => void = () => {};

  constructor(id: string, height: number) {
    this.id = id;
    this.H = height;
    this.W = Math.round(height * SPRITE_ASPECT);
  }

  resize(height: number) {
    this.H = height;
    this.W = Math.round(height * SPRITE_ASPECT);
  }

  /** half the width her paws need on a surface */
  get foot() {
    return this.W * 0.3;
  }
  ledge(el: Element | null) {
    return ledgeOf(el, this.foot, this.H);
  }

  setView(patch: Partial<BodyView>) {
    const next = { ...this.view, ...patch };
    if (next.anim === this.view.anim && next.face === this.view.face && next.frame === this.view.frame && next.loop === this.view.loop && next.tint === this.view.tint) return;
    if (patch.face && this.blinkUntil) this.blinkUntil = 0;
    this.view = next;
    this.onView(next);
  }
  anim(anim: CatAnim, extra: Partial<BodyView> = {}) {
    this.setView({ anim, frame: undefined, loop: true, ...extra });
  }
  face(face: CatFace) {
    this.setView({ face });
  }

  /* ---------------- control ---------------- */
  /** Cancel whatever she's doing; returns a token that is current until the next interrupt */
  interrupt() {
    this.token++;
    this.finish(false);
    this.lift = 0;
    this.spin = 0;
    this.jitter = 0;
    this.sx = this.sy = 1;
    this.bob = 'breathe';
    // every new plan starts from a neutral pose (mid-air poses stay; gravity finishes those)
    const a = this.view.anim;
    this.setView(a === 'jump' || a === 'fall' ? { face: 'normal' } : { face: 'normal', anim: 'idle', frame: undefined, loop: true });
    return this.token;
  }
  alive(tok: number) {
    return tok === this.token;
  }
  private finish(ok: boolean) {
    const d = this.done;
    this.motion = null;
    this.done = null;
    this.airborne = false;
    d?.(ok);
  }
  private start(m: Motion, airborne = false) {
    this.finish(false);
    return new Promise<boolean>((res) => {
      this.motion = m;
      this.done = res;
      this.airborne = airborne;
    });
  }

  /** Free fall until she lands on whatever is below */
  private gravity(dt: number) {
    this.vy = Math.min(1600, this.vy + 2600 * dt);
    const land = landingBelow(this, this.x, this.y);
    const ny = this.y + this.vy * dt;
    this.rot -= this.rot * Math.min(1, 6 * dt); // straighten up on the way down
    if (this.view.anim !== 'fall' && this.view.anim !== 'hurt') this.anim('fall');
    if (land && ny >= land.y) {
      this.vy = 0;
      this.place(land.g, land.g.kind === 'orb' ? land.angle! : this.x);
      this.anim('idle');
      this.squash();
    } else this.y = ny;
  }

  /* ---------------- placement ---------------- */
  place(g: Ground, xOrAngle: number) {
    this.ground = g;
    if (g.kind === 'orb') this.angle = xOrAngle;
    else {
      this.x = xOrAngle;
      if (g.kind === 'ledge') this.relX = xOrAngle - (this.ledge(g.el)?.left ?? 0);
    }
    this.settle();
  }

  /** Where she'd stand on a ground right now (feet point, rotation); null when it's gone */
  pointOn(g: Ground, xOrAngle: number): { x: number; y: number; rot: number } | null {
    if (g.kind === 'floor') return { x: this.free ? xOrAngle : clamp(xOrAngle, this.foot, innerWidth - this.foot), y: floorY(), rot: 0 };
    if (g.kind === 'ledge') {
      const l = this.ledge(g.el);
      return l ? { x: clamp(xOrAngle, l.minX, l.maxX), y: l.y, rot: 0 } : null;
    }
    if (g.kind === 'orb') {
      const c = circleOf(g.el);
      return c ? { x: c.cx + c.r * Math.cos(xOrAngle * deg), y: c.cy + c.r * Math.sin(xOrAngle * deg), rot: xOrAngle + 90 } : null;
    }
    return { x: this.x, y: this.y, rot: this.rot };
  }

  /** Re-read her ground (windows move, the orb floats) */
  settle() {
    const g = this.ground;
    if (g.kind === 'air' || this.dragging) return;
    if (g.kind === 'ledge') {
      const l = this.ledge(g.el);
      if (!l) return this.onLostGround();
      this.x = clamp(l.left + this.relX, l.minX, l.maxX);
      this.y = l.y;
      this.rot = 0;
      return;
    }
    const p = this.pointOn(g, g.kind === 'orb' ? this.angle : this.x);
    if (!p) return this.onLostGround();
    this.x = p.x;
    this.y = p.y;
    this.rot = p.rot;
  }

  /** The point above her head, for bubbles (screen coords) */
  head(extra = 0) {
    const a = (this.rot + this.spin) * deg;
    const up = this.lift + this.H * 0.8 + extra;
    return { x: this.x + Math.sin(a) * up, y: this.y - Math.cos(a) * up };
  }
  /** Her centre, for the info card */
  centre() {
    const a = (this.rot + this.spin) * deg;
    const up = this.lift + this.H * 0.45;
    return { x: this.x + Math.sin(a) * up, y: this.y - Math.cos(a) * up };
  }

  /* ---------------- per-frame ---------------- */
  update(dt: number, now: number) {
    // a motion can be replaced from inside itself (her ledge vanished and she started falling): never finish the new one
    const m = this.motion;
    if (m && m(dt, now) && this.motion === m) this.finish(true);
    else this.settle(); // while waiting / napping she still rides her window and the floating orb
    if (this.squashing > 0) this.squashing = Math.max(0, this.squashing - dt * 4);
    if (this.ground.kind === 'air' && !this.dragging && !this.airborne) this.gravity(dt);
    if (this.ground.kind === 'ledge') {
      const l = this.ledge(this.ground.el);
      if (l) this.relX = this.x - l.left;
    }
    // blinking: every few seconds while standing or walking with a plain face
    if (this.blinkUntil && now > this.blinkUntil) {
      this.blinkUntil = 0;
      if (this.view.face === 'blink') this.setView({ face: this.faceBeforeBlink });
    } else if (now > this.nextBlink) {
      this.nextBlink = now + rand(2500, 6000);
      if ((this.view.anim === 'idle' || this.view.anim === 'walk') && this.view.face === 'normal' && this.view.frame === undefined) {
        this.faceBeforeBlink = 'normal';
        this.setView({ face: 'blink' });
        this.blinkUntil = now + 140 + (Math.random() < 0.2 ? 260 : 0); // sometimes a slow, sleepy blink
      }
    }
    this.paint(now);
  }

  paint(now = performance.now()) {
    const el = this.el;
    if (!el) return;
    const ox = this.W * FEET.x;
    const oy = this.H * FEET.y;
    const sq = this.squashing * this.squashing;
    let sy = this.sy * (1 - 0.14 * sq);
    const sx = this.sx * (1 + 0.08 * sq);
    let rot = this.rot + this.spin;
    let lift = this.lift;
    let jx = this.jitter ? Math.sin(now / 22) * this.jitter : 0;
    const t = now / 1000;
    if (this.bob === 'breathe' && this.view.anim !== 'walk' && this.view.anim !== 'run') sy *= 1 + Math.sin(t * 2.4) * 0.012;
    else if (this.bob === 'eat') {
      rot += Math.sin(t * 16) * 5;
      sy *= 1 - Math.abs(Math.sin(t * 8)) * 0.05;
    } else if (this.bob === 'groom') rot += Math.sin(t * 9) * 7;
    else if (this.bob === 'purr') {
      jx += Math.sin(t * 70) * 0.6;
      sy *= 1 + Math.sin(t * 2) * 0.015;
    }
    if (lift < 0) lift = 0;
    el.style.transformOrigin = `${ox}px ${oy}px`;
    el.style.transform = `translate3d(${this.x - ox + jx}px, ${this.y - oy}px, 0) rotate(${rot}deg) translateY(${-lift}px) scale(${(this.flip ? -1 : 1) * sx}, ${sy})`;
  }

  /* ---------------- moves (resolve false when interrupted) ---------------- */
  wait(ms: number) {
    let left = ms;
    return this.start((dt) => (left -= dt * 1000) <= 0);
  }

  /** Walk / run along the floor or a ledge */
  walk(tx: number, speed = 80, anim: CatAnim = 'walk') {
    if (this.ground.kind === 'orb' || this.ground.kind === 'air') return Promise.resolve(false);
    const p = this.pointOn(this.ground, tx);
    if (!p) return Promise.resolve(false);
    const target = p.x;
    if (Math.abs(target - this.x) < 3) {
      this.finish(false);
      return Promise.resolve(true);
    }
    this.flip = target < this.x;
    this.anim(anim);
    return this.start((dt) => {
      this.settle();
      const p2 = this.pointOn(this.ground, target);
      const goal = p2 ? p2.x : target;
      const step = speed * dt;
      if (Math.abs(goal - this.x) <= step) {
        this.x = goal;
        if (this.ground.kind === 'ledge') this.relX = this.x - (this.ledge(this.ground.el)?.left ?? 0);
        this.anim('idle');
        return true;
      }
      this.x += Math.sign(goal - this.x) * step;
      if (this.ground.kind === 'ledge') this.relX = this.x - (this.ledge(this.ground.el)?.left ?? 0);
      return false;
    });
  }
  run(tx: number) {
    return this.walk(tx, 240, 'run');
  }

  /** Walk around the orb to an angle (can be more than a full turn: loop-the-loop!) */
  arc(toAngle: number, speed = 70, anim: CatAnim = 'walk') {
    if (this.ground.kind !== 'orb') return Promise.resolve(false);
    const el = this.ground.el;
    const dir = Math.sign(toAngle - this.angle);
    if (!dir) {
      this.finish(false);
      return Promise.resolve(true);
    }
    this.flip = dir < 0; // clockwise = walking right
    this.anim(anim);
    return this.start((dt) => {
      const c = circleOf(el);
      if (!c) {
        this.onLostGround();
        return false;
      }
      const step = (speed * dt) / c.r / deg;
      if (Math.abs(toAngle - this.angle) <= step) {
        this.angle = toAngle;
        this.settle();
        this.anim('idle');
        return true;
      }
      this.angle += dir * step;
      this.settle();
      return false;
    });
  }

  /** A parabolic hop to a point on any ground; she lands with a squash */
  jump(g: Ground, xOrAngle: number, opts: { height?: number; duration?: number } = {}) {
    const from = { x: this.x, y: this.y, rot: this.rot };
    const target = this.pointOn(g, xOrAngle);
    if (!target) return Promise.resolve(false);
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const dur = opts.duration ?? clamp(0.35 + dist / 1400, 0.4, 0.85);
    const peak = opts.height ?? clamp(40 + dist * 0.25 + Math.max(0, from.y - target.y) * 0.35, 40, 220);
    if (Math.abs(target.x - from.x) > 4) this.flip = target.x < from.x;
    this.ground = { kind: 'air' };
    this.anim('jump', { loop: false });
    let t = 0;
    let fell = false;
    let rot1 = target.rot;
    // turn the short way round
    while (rot1 - from.rot > 180) rot1 -= 360;
    while (rot1 - from.rot < -180) rot1 += 360;
    return this.start((dt) => {
      t = Math.min(1, t + dt / dur);
      const now = this.pointOn(g, xOrAngle) ?? target;
      this.x = from.x + (now.x - from.x) * t;
      this.y = from.y + (now.y - from.y) * t - peak * 4 * t * (1 - t);
      this.rot = from.rot + (rot1 - from.rot) * ease(t);
      if (!fell && t > 0.5) {
        fell = true;
        this.anim('fall');
      }
      if (t < 1) return false;
      if (!this.pointOn(g, xOrAngle)) {
        // the window closed while she was flying: just drop
        this.ground = { kind: 'air' };
        this.vy = 0;
        return true;
      }
      this.place(g, xOrAngle);
      this.anim('idle');
      this.squash();
      return true;
    }, true);
  }

  /** Drop under gravity onto whatever is below: a window top, the orb, or the floor */
  fall() {
    this.ground = { kind: 'air' };
    this.vy = 0;
    this.anim('fall');
    return this.start(() => this.ground.kind !== 'air');
  }

  /** A little bounce in place */
  hop(height = 30, duration = 0.34) {
    duration = Math.max(0.05, duration);
    let t = 0;
    this.anim('jump', { loop: false });
    return this.start((dt) => {
      t = Math.min(1, t + dt / duration);
      this.settle();
      this.lift = height * 4 * t * (1 - t);
      if (t < 1) return false;
      this.lift = 0;
      this.anim('idle');
      return true;
    });
  }

  /** Chase her own tail */
  twirl(turns = 2, duration = 1.4) {
    duration = Math.max(0.05, duration);
    let t = 0;
    this.anim('run');
    return this.start((dt) => {
      t = Math.min(1, t + dt / duration);
      this.settle();
      this.spin = 0;
      this.flip = Math.floor(t * turns * 2) % 2 === 1;
      this.lift = Math.abs(Math.sin(t * Math.PI * turns * 2)) * 10;
      this.sx = 1 - Math.abs(Math.sin(t * Math.PI * turns * 2)) * 0.25;
      if (t < 1) return false;
      this.lift = 0;
      this.sx = 1;
      this.anim('idle');
      return true;
    });
  }

  /** a landing squash that springs back over ~¼s */
  private squash() {
    this.squashing = 1;
  }
}

/** The highest surface under a point: a window top, the top half of the orb, or the floor */
export function landingBelow(b: Body, x: number, y: number): { g: Ground; y: number; angle?: number } | null {
  let best: { g: Ground; y: number; angle?: number } = { g: { kind: 'floor' }, y: floorY() };
  for (const el of ledges()) {
    const l = b.ledge(el);
    if (l && x >= l.minX - b.foot && x <= l.maxX + b.foot && l.y >= y - 4 && l.y < best.y) best = { g: { kind: 'ledge', el }, y: l.y };
  }
  const o = orbEl();
  const c = circleOf(o);
  if (o && c && Math.abs(x - c.cx) < c.r * 0.92) {
    const top = c.cy - Math.sqrt(c.r * c.r - (x - c.cx) ** 2);
    if (top >= y - 4 && top < best.y) best = { g: { kind: 'orb', el: o }, y: top, angle: Math.atan2(top - c.cy, x - c.cx) / deg };
  }
  return best;
}

const MOVES = new Set<PropertyKey>(['wait', 'walk', 'run', 'arc', 'jump', 'fall', 'hop', 'twirl']);
const VIEWS = new Set<PropertyKey>(['face', 'anim', 'setView', 'place']);
/**
 * The body as one action sees it. When something interrupts that action, the rest of its story can't
 * move her or change her face any more, so a half-finished action never fights the next one.
 */
export function scoped(b: Body, tok: number): Body {
  return new Proxy(b, {
    get(t, k) {
      const v = Reflect.get(t, k, t);
      if (typeof v !== 'function') return v;
      if (MOVES.has(k)) return (...a: unknown[]) => (t.alive(tok) ? v.apply(t, a) : Promise.resolve(false));
      if (VIEWS.has(k)) return (...a: unknown[]) => void (t.alive(tok) && v.apply(t, a));
      return v.bind(t);
    },
    set(t, k, val) {
      if (t.alive(tok)) Reflect.set(t, k, val, t);
      return true;
    },
  });
}

/** Keep an orb angle in [-180, 180) */
export const normAngle = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
/** The copy of `target` (± full turns) closest to `from`, so she walks the short way round */
export const nearAngle = (target: number, from: number) => target + Math.round((from - target) / 360) * 360;

/* ------------------------------------------------------------------ */
/* Props: a bowl, a yarn ball, a box, a butterfly…                      */
/* ------------------------------------------------------------------ */
export class Thing {
  x = 0;
  y = 0;
  rot = 0;
  s = 1;
  o = 1;
  el: HTMLElement | null = null;
  private motion: ((dt: number) => boolean) | null = null;
  private done: ((ok: boolean) => void) | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  private start(m: (dt: number) => boolean) {
    this.done?.(false);
    return new Promise<boolean>((res) => {
      this.motion = m;
      this.done = res;
    });
  }
  /** Move to new values over `dur` seconds */
  tween(to: Partial<Pick<Thing, 'x' | 'y' | 'rot' | 's' | 'o'>>, dur: number, curve: 'inOut' | 'in' | 'out' | 'linear' = 'inOut') {
    const from = { x: this.x, y: this.y, rot: this.rot, s: this.s, o: this.o };
    const f = curve === 'in' ? (t: number) => t * t : curve === 'out' ? (t: number) => 1 - (1 - t) ** 2 : curve === 'linear' ? (t: number) => t : ease;
    let t = 0;
    return this.start((dt) => {
      t = Math.min(1, t + dt / Math.max(0.01, dur));
      const k = f(t);
      for (const key of Object.keys(to) as (keyof typeof from)[]) {
        const v = to[key];
        if (v !== undefined) this[key] = from[key] + (v - from[key]) * k;
      }
      return t >= 1;
    });
  }
  /** Follow a path: fn(t 0..1) -> position */
  path(fn: (t: number) => Partial<Pick<Thing, 'x' | 'y' | 'rot' | 's' | 'o'>>, dur: number) {
    let t = 0;
    return this.start((dt) => {
      t = dur <= 0 ? 1 : Math.min(1, t + dt / dur);
      Object.assign(this, fn(t));
      return t >= 1;
    });
  }
  stop() {
    this.motion = null;
    this.done?.(false);
    this.done = null;
  }
  update(dt: number) {
    if (this.motion && this.motion(dt)) {
      this.motion = null;
      const d = this.done;
      this.done = null;
      d?.(true);
    }
    if (this.el) {
      this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) translate(-50%, -100%) rotate(${this.rot}deg) scale(${this.s})`;
      this.el.style.opacity = String(this.o);
    }
  }
}
