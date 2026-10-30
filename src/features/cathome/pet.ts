import type { CatAnim, CatFace } from '../cat/CatSprite';
import { zOfY } from './catalog';

/**
 * A cat walking around a room. Positions are fractions of the room (x of its width, y of its height,
 * at her feet); moves are promises that resolve false when something interrupts them.
 */
export interface PetView {
  anim: CatAnim;
  face: CatFace;
  frame?: number;
  flip: boolean;
}
type Motion = (dt: number) => boolean;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class Pet {
  x: number;
  y: number;
  lift = 0;
  /** while she sits on a piece of furniture: paint over it (until her feet pass below `perchY`) */
  perchZ = 0;
  perchY = 0;
  /** room aspect (width / height), so speeds feel the same both ways */
  aspect = 16 / 9;
  view: PetView = { anim: 'idle', face: 'normal', flip: false };
  el: HTMLElement | null = null;
  token = 0;
  onView: (v: PetView) => void = () => {};
  private motion: Motion | null = null;
  private done: ((ok: boolean) => void) | null = null;
  private nextBlink = performance.now() + 3000;
  private blinkUntil = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  set(patch: Partial<PetView>) {
    const n = { ...this.view, ...patch };
    if (n.anim === this.view.anim && n.face === this.view.face && n.frame === this.view.frame && n.flip === this.view.flip) return;
    this.view = n;
    this.onView(n);
  }
  face(face: CatFace) {
    this.set({ face });
  }
  anim(anim: CatAnim, frame?: number) {
    this.set({ anim, frame });
  }

  interrupt() {
    this.token++;
    this.finish(false);
    this.lift = 0;
    this.set({ anim: 'idle', frame: undefined, face: 'normal' });
    return this.token;
  }
  alive(tok: number) {
    return tok === this.token;
  }
  private finish(ok: boolean) {
    const d = this.done;
    this.motion = null;
    this.done = null;
    d?.(ok);
  }
  private start(m: Motion) {
    this.finish(false);
    return new Promise<boolean>((res) => {
      this.motion = m;
      this.done = res;
    });
  }

  update(dt: number, now: number) {
    const m = this.motion;
    if (m && m(dt) && this.motion === m) this.finish(true);
    if (this.blinkUntil && now > this.blinkUntil) {
      this.blinkUntil = 0;
      if (this.view.face === 'blink') this.face('normal');
    } else if (now > this.nextBlink) {
      this.nextBlink = now + 2500 + Math.random() * 3500;
      if (this.view.anim === 'idle' && this.view.face === 'normal' && this.view.frame === undefined) {
        this.face('blink');
        this.blinkUntil = now + 150;
      }
    }
    this.paint();
  }
  paint() {
    if (!this.el) return;
    this.el.style.left = `${this.x * 100}%`;
    this.el.style.top = `${this.y * 100}%`;
    this.el.style.zIndex = String(this.perchZ && this.y < this.perchY ? this.perchZ : zOfY(this.y) + 1);
    this.el.style.transform = `translate(-50%, -100%) translateY(${-this.lift}px)`;
  }

  wait(ms: number) {
    let left = ms;
    return this.start((dt) => (left -= dt * 1000) <= 0);
  }
  /** walk (speed in room heights per second) */
  walk(x: number, y = this.y, speed = 0.12, anim: CatAnim = 'walk') {
    const dx = (x - this.x) * this.aspect;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.004) return Promise.resolve(true);
    if (Math.abs(dx) > 0.002) this.set({ flip: dx < 0 });
    this.anim(anim);
    const x0 = this.x;
    const y0 = this.y;
    let t = 0;
    const dur = dist / speed;
    return this.start((dt) => {
      t = Math.min(1, t + dt / dur);
      this.x = x0 + (x - x0) * t;
      this.y = y0 + (y - y0) * t;
      if (t < 1) return false;
      this.anim('idle');
      return true;
    });
  }
  run(x: number, y = this.y) {
    return this.walk(x, y, 0.32, 'run');
  }
  /** an arc onto (or off) furniture; `px` = her height in pixels for the arc */
  hopTo(x: number, y: number, height = 40, dur = 0.5) {
    const x0 = this.x;
    const y0 = this.y;
    if (Math.abs(x - x0) > 0.002) this.set({ flip: x < x0 });
    this.set({ anim: 'jump', frame: undefined });
    let t = 0;
    let fell = false;
    return this.start((dt) => {
      t = Math.min(1, t + dt / dur);
      this.x = x0 + (x - x0) * t;
      this.y = y0 + (y - y0) * ease(t);
      this.lift = height * 4 * t * (1 - t);
      if (!fell && t > 0.5) {
        fell = true;
        this.anim('fall');
      }
      if (t < 1) return false;
      this.lift = 0;
      this.anim('idle');
      return true;
    });
  }
  hop(height = 26, dur = 0.34) {
    let t = 0;
    this.set({ anim: 'jump', frame: undefined });
    return this.start((dt) => {
      t = Math.min(1, t + dt / dur);
      this.lift = height * 4 * t * (1 - t);
      if (t < 1) return false;
      this.lift = 0;
      this.anim('idle');
      return true;
    });
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
