import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTimer } from '@/store/timer';
import { useUI } from '@/store/ui';
import { usePrefs } from '@/store/prefs';
import { useMixerStatus } from '@/audio/mixer';
import { bus } from '@/lib/bus';
import { pick } from '@/lib/utils';
import { CatSprite, FEET } from './CatSprite';
import { useCat, moodOf, MOOD_FACE, catSound, levelOf, levelProgress, nextMilestone, unlocked, MAX_LEVEL } from './brain';
import { SKINS, preloadSkin, type SkinId } from './skins';
import { Body, Thing, clamp, floorY, rand, scoped, type BodyView } from './world';
import * as L from './lines';
import { ACTS, annoyed, chooseMom, cheer, eat, focusStep, happy, kittenStep, nap, partnerVisit, sleep, sound, toOrb, SHOULDERS, type Ctx, type ParticleKind, type ThingKind } from './behaviors';

/**
 * The cat (and later her family) living on the whole screen. Bodies move in world.ts, decisions live in
 * behaviors.ts; this file renders them, wires up events, petting / dragging, and the info card.
 */
interface Particle {
  id: number;
  text: string;
  kind: ParticleKind;
  x: number;
  y: number;
  dx: number;
}
const sizeFor = () => (innerWidth < 640 ? 108 : 154);
let seq = 1;

export default function CatWorld() {
  const zen = useUI((s) => s.zen);
  const cat = useCat();
  const { name, skin, kittens, showFamily, partner, treats, hunger, energy, joy, xp } = cat;
  const mood = moodOf(cat);

  const [H, setH] = useState(sizeFor);
  const mom = useRef<Body>(null as unknown as Body);
  if (!mom.current) mom.current = new Body('mom', sizeFor());
  const kitBodies = useRef(new Map<string, Body>());
  const partnerBody = useRef<Body | null>(null);
  const things = useRef(new Map<ThingKind, Thing>());

  const [views, setViews] = useState<Record<string, BodyView>>({});
  const [speech, setSpeech] = useState<Record<string, { id: number; text: string }>>({});
  const [emotes, setEmotes] = useState<Record<string, { id: number; emoji: string }>>({});
  const [tints, setTints] = useState<Record<string, 'sad' | 'mad' | null>>({});
  const [clouds, setClouds] = useState<Record<string, boolean>>({});
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shown, setShown] = useState<Partial<Record<ThingKind, string>>>({});
  const [crown, setCrown] = useState(false);
  const [card, setCard] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [visiting, setVisiting] = useState(false);
  const [ready, setReady] = useState(false);

  const speechEls = useRef(new Map<string, HTMLElement>());
  const hitEls = useRef(new Map<string, HTMLElement>());
  const emoteEls = useRef(new Map<string, HTMLElement>());
  const cloudEls = useRef(new Map<string, HTMLElement>());
  const tagEl = useRef<HTMLElement | null>(null);
  const cardEl = useRef<HTMLElement | null>(null);
  const cardOpen = useRef(false);
  cardOpen.current = card;
  const pointer = useRef({ x: innerWidth / 2, y: innerHeight / 2, at: 0 }).current;
  const reduced = useRef(false);
  const timers = useRef(new Map<string, number>());

  const bodies = () => [mom.current, ...kitBodies.current.values(), ...(partnerBody.current ? [partnerBody.current] : [])];
  const later = (key: string, fn: () => void, ms: number) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, window.setTimeout(fn, ms));
  };

  /* ---------------- the context behaviours talk to ---------------- */
  const ctx = useMemo<Ctx>(
    () => ({
      mom: mom.current,
      kittens: () => [...kitBodies.current.values()],
      partner: () => partnerBody.current,
      orb: () => document.querySelector('[data-cat-orb]'),
      say: (b, text, ms = 3600) => {
        const id = seq++;
        setSpeech((s) => ({ ...s, [b.id]: { id, text } }));
        later(`say:${b.id}`, () => setSpeech((s) => (s[b.id]?.id === id ? { ...s, [b.id]: undefined! } : s)), ms);
      },
      emote: (b, emoji, ms = 1800) => {
        const id = seq++;
        setEmotes((s) => ({ ...s, [b.id]: { id, emoji } }));
        later(`emote:${b.id}`, () => setEmotes((s) => (s[b.id]?.id === id ? { ...s, [b.id]: undefined! } : s)), ms);
      },
      burst: (b, items, kind = 'float') => {
        const h = b.head(kind === 'drop' ? 4 : -6);
        const add = items.map((text) => ({ id: seq++, text, kind, x: h.x + rand(-b.W * 0.15, b.W * 0.15), y: h.y, dx: rand(-24, 24) }));
        setParticles((p) => [...p.slice(-24), ...add]);
        window.setTimeout(() => setParticles((p) => p.filter((x) => !add.includes(x))), 1700);
      },
      show: (kind, x, y, emoji = '') => {
        let t = things.current.get(kind);
        if (t) t.stop();
        else things.current.set(kind, (t = new Thing(x, y)));
        Object.assign(t, { x, y, rot: 0, s: 1, o: 1 });
        setShown((s) => ({ ...s, [kind]: emoji }));
        return t;
      },
      hide: (kind) => {
        things.current.get(kind)?.stop();
        things.current.delete(kind);
        setShown((s) => {
          const n = { ...s };
          delete n[kind];
          return n;
        });
      },
      thing: (kind) => things.current.get(kind) ?? null,
      tint: (b, t) => setTints((s) => ({ ...s, [b.id]: t })),
      cloud: (b, on) => setClouds((s) => ({ ...s, [b.id]: on })),
      pointer,
      focus: () => {
        const t = useTimer.getState();
        return t.mode === 'focus' && t.status === 'running';
      },
      breakTime: () => {
        const t = useTimer.getState();
        return t.mode !== 'focus' && t.status === 'running';
      },
      music: () => Object.values(useMixerStatus.getState().status).includes('playing') || !!usePrefs.getState().musicVideo?.open,
      reduced: () => reduced.current,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** A reaction takes over a cat until it finishes; her own plans wait */
  const react = async (b: Body, fn: (tok: number, me: Body) => Promise<unknown>) => {
    const my = ++b.reactSeq;
    b.reacting = true;
    const tok = b.interrupt();
    ctx.tint(b, null);
    ctx.cloud(b, false);
    if (b === mom.current) useCat.getState().setAsleep(false);
    try {
      await Promise.race([fn(tok, scoped(b, tok)), sleep(20000)]);
    } finally {
      if (b.reactSeq === my) b.reacting = false;
    }
  };
  const reactRef = useRef(react);
  reactRef.current = react;

  const wire = (b: Body) => {
    b.onView = (v) => setViews((s) => ({ ...s, [b.id]: v }));
    b.onLostGround = () => {
      if (b.dragging) return;
      void reactRef.current(b, async (_t, b) => {
        await b.fall();
        b.anim('hurt', { loop: false });
        ctx.emote(b, '💫', 1200);
        await b.wait(700);
        b.anim('idle');
      });
    };
  };

  /* ---------------- mount: place her, greet, start the loops ---------------- */
  useEffect(() => {
    const m = mom.current;
    wire(m);
    let alive = true;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => (reduced.current = e.matches);
    mq.addEventListener('change', onMq);

    const away = Date.now() - useCat.getState().lastTick;
    useCat.getState().tick();
    const tickId = setInterval(() => useCat.getState().tick(), 60_000);
    // she appears (and starts talking) once every pose of her skin is loaded
    const loaded = preloadSkin(useCat.getState().skin).then(() => void (alive && setReady(true)));
    m.place({ kind: 'floor' }, innerWidth * rand(0.3, 0.7));

    // greeting
    void (async () => {
      await Promise.all([sleep(900), loaded]);
      await sleep(300);
      if (!alive) return;
      const h = new Date().getHours();
      const lines = away > 8 * 3_600_000 ? L.GREET.long : h < 5 || h >= 23 ? L.GREET.night : h < 12 ? L.GREET.morning : h >= 18 ? L.GREET.evening : L.GREET.day;
      await react(m, async (_t, m) => {
        m.face('love');
        ctx.say(m, pick(lines), 4200);
        sound(m, 'meow');
        await m.hop(34);
        await m.hop(24);
        m.face('normal');
      });
    })();

    // her own life
    void (async () => {
      const last: string[] = [];
      await loaded;
      await sleep(4500);
      while (alive) {
        if (m.reacting || m.dragging || cardOpen.current) {
          await sleep(400);
          continue;
        }
        const tok = m.interrupt();
        if (ctx.focus()) await Promise.race([focusStep(ctx, scoped(m, tok)), sleep(90_000)]);
        else {
          const [k, act] = chooseMom(ctx, last);
          last.push(k);
          if (last.length > 5) last.shift();
          await Promise.race([act(ctx, scoped(m, tok), tok), sleep(30_000)]);
        }
        if (!alive) break;
        if (m.alive(tok) && !m.reacting) await m.wait(ctx.focus() ? rand(4000, 9000) : rand(2200, 5500));
      }
    })();

    // little pep talks during focus, and soft purrs now and then
    const cheerLoop = async () => {
      while (alive) {
        await sleep(rand(200_000, 360_000));
        if (alive && ctx.focus() && useCat.getState().cheers && !m.dragging) cheer(ctx);
      }
    };
    const purrLoop = async () => {
      while (alive) {
        await sleep(rand(150_000, 300_000));
        const st = useCat.getState();
        if (!alive || !st.purrs || m.dragging || m.view.anim === 'walk' || m.view.anim === 'run' || m.ground.kind === 'air') continue;
        catSound('purr', ctx.focus() ? 0.1 : 0.15);
        const bob = m.bob;
        m.bob = 'purr';
        if (Math.random() < 0.35) ctx.say(m, pick(L.PURR_LINES), 2400);
        await sleep(3500);
        if (m.bob === 'purr') m.bob = bob === 'purr' ? 'breathe' : bob;
      }
    };
    void cheerLoop();
    void purrLoop();

    // a visitor now and then, once she has someone special
    const visitId = setInterval(() => {
      const st = useCat.getState();
      if (!st.partner || partnerBody.current || ctx.focus() || Math.random() > 0.14) return;
      void visit();
    }, 60_000);

    const onResize = () => {
      const h = sizeFor();
      setH(h);
      m.resize(h);
      for (const k of kitBodies.current.values()) k.resize(h * 0.52);
      partnerBody.current?.resize(h * 1.04);
    };
    const onMove = (e: PointerEvent) => Object.assign(pointer, { x: e.clientX, y: e.clientY, at: Date.now() });
    // dev-only handle for QA scripts: run any behaviour on demand
    if (import.meta.env.DEV)
      Object.assign(window, { __cat: { ctx, mom: m, kittens: () => [...kitBodies.current.values()], act: (k: string) => react(m, (tok, me) => ACTS[k](ctx, me, tok)), react, visit: () => visitRef.current(true), toOrb } });
    addEventListener('resize', onResize);
    addEventListener('pointermove', onMove, { passive: true });

    return () => {
      alive = false;
      m.interrupt();
      clearInterval(tickId);
      clearInterval(visitId);
      mq.removeEventListener('change', onMq);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove);
      timers.current.forEach((t) => clearTimeout(t));
    };
    // mount only: everything inside reads live state through refs and getState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a new skin paints before she wears it
  useEffect(() => {
    void preloadSkin(skin);
    kittens.forEach((k) => void preloadSkin(k.skin));
    if (partner) void preloadSkin(partner.skin);
  }, [skin, kittens, partner]);

  /* ---------------- kittens: one body + one little life each ---------------- */
  const kitKey = showFamily ? kittens.map((k) => k.id).join(',') : '';
  useEffect(() => {
    const want = new Set(kitKey ? kitKey.split(',') : []);
    const alive = new Map<string, { on: boolean }>();
    for (const [id, b] of kitBodies.current) {
      if (!want.has(id.slice(2))) {
        b.interrupt();
        kitBodies.current.delete(id);
      }
    }
    for (const id of want) {
      const key = `k:${id}`;
      if (kitBodies.current.has(key)) continue;
      const b = new Body(key, sizeFor() * 0.52);
      wire(b);
      kitBodies.current.set(key, b);
      b.place({ kind: 'floor' }, clamp(mom.current.x + rand(-1, 1) * mom.current.W, b.foot, innerWidth - b.foot));
    }
    // each kitten's life (restarted whenever the litter changes)
    for (const [key, b] of kitBodies.current) {
      const flag = { on: true };
      alive.set(key, flag);
      void (async () => {
        await sleep(rand(800, 2500));
        while (flag.on) {
          if (b.reacting || b.dragging) {
            await sleep(400);
            continue;
          }
          const tok = b.interrupt();
          await Promise.race([kittenStep(ctx, scoped(b, tok), tok), sleep(60_000)]);
          if (flag.on && b.alive(tok)) await b.wait(rand(900, 3200));
        }
      })();
    }
    setViews((v) => ({ ...v }));
    return () => alive.forEach((f) => (f.on = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitKey]);

  /* ---------------- her partner's visits ---------------- */
  const visit = async (intro = false) => {
    const st = useCat.getState();
    if (!st.partner || partnerBody.current) return;
    const p = new Body('partner', sizeFor() * 1.04);
    wire(p);
    partnerBody.current = p;
    setVisiting(true);
    await sleep(50);
    const m = mom.current;
    if (intro) void react(m, async (_t, m) => {
      m.face('love');
      ctx.say(m, L.FAMILY.partner(st.partner!.name), 4000);
      await m.wait(4000);
      m.face('normal');
    });
    await partnerVisit(ctx, scoped(p, p.token), p.token, st.partner.name);
    p.interrupt();
    partnerBody.current = null;
    setVisiting(false);
  };
  const visitRef = useRef(visit);
  visitRef.current = visit;

  /* ---------------- app events ---------------- */
  useEffect(() => {
    const m = mom.current;
    const kids = () => [...kitBodies.current.values()];
    const offs = [
      bus.on('session:start', () => {
        void react(m, async (tok, m) => {
          m.face('star');
          ctx.say(m, pick(L.START), 3800);
          await m.hop(30);
          if (!m.alive(tok)) return;
          m.face('normal');
          await toOrb(ctx, m, pick(SHOULDERS), Math.random() < 0.5);
          await nap(ctx, m, 4000);
        });
      }),
      bus.on('session:complete', (p) => {
        useCat.getState().onSessionDone(Math.round(p.seconds / 60));
        setCrown(true);
        later('crown', () => setCrown(false), 7000);
        void react(m, async (_t, m) => {
          m.face('star');
          ctx.say(m, p.goalReached ? 'Daily goal smashed!! 🏆' : pick(L.DONE), 4500);
          ctx.burst(m, ['💖', '✨', '💕', '⭐'], 'float');
          if (m.ground.kind === 'orb' && !reduced.current) {
            await m.arc(m.angle + (Math.random() < 0.5 ? 360 : -360), 300, 'run');
            m.angle = ((m.angle % 360) + 540) % 360 - 180;
          }
          for (let i = 0; i < 3; i++) {
            ctx.burst(m, [i % 2 ? '💕' : '💖'], 'float');
            if (!(await m.hop(30))) return;
            m.face('star');
          }
          m.face('love');
          await m.wait(1500);
          m.face('normal');
        });
        for (const k of kids()) void react(k, async (_t, k) => {
          k.face('star');
          await k.hop(26);
          await k.hop(20);
          k.face('normal');
        });
      }),
      bus.on('session:early', () => {
        useCat.getState().onSessionEarly();
        void react(m, async (_t, m) => {
          ctx.say(m, pick(L.EARLY), 3800);
          m.anim('dead', { loop: false });
          await m.wait(1600);
          m.anim('idle');
          m.face('sad');
          await m.wait(1400);
          m.face('normal');
        });
      }),
      bus.on('break:complete', () => {
        void react(m, async (_t, m) => {
          m.face('star');
          ctx.say(m, pick(L.BREAK_END), 3600);
          await m.hop(26);
          m.face('normal');
        });
      }),
      bus.on('task:done', () => {
        void react(m, async (_t, m) => {
          m.face('happy');
          ctx.emote(m, '✅');
          ctx.say(m, 'Task crushed! ✅', 2800);
          await m.hop(26);
          m.face('normal');
        });
      }),
      bus.on('achievement', () => {
        void react(m, async (_t, m) => {
          m.face('star');
          ctx.emote(m, '🏅');
          await m.hop(28);
          m.face('normal');
        });
      }),
      bus.on('mascot:say', (p) => {
        if (!p?.text) return;
        ctx.say(m, p.text, p.ms ?? 3800);
        if (m.view.anim !== 'slide') {
          m.face('star');
          later('face', () => m.view.face === 'star' && m.face('normal'), 1800);
        }
      }),
      bus.on('cat:event', (e) => {
        void react(m, async (_t, m) => {
          m.face('love');
          if (e.kind === 'level') ctx.say(m, L.FAMILY.level(e.level ?? 1), 3800);
          else if (e.kind === 'expecting') ctx.say(m, pick(L.FAMILY.expecting), 4200);
          else if (e.kind === 'born') ctx.say(m, L.FAMILY.born(e.names?.[0] ?? '', e.names?.[1] ?? ''), 5000);
          else if (e.kind === 'kitten') ctx.say(m, L.FAMILY.kitten(e.names?.[0] ?? ''), 4200);
          ctx.burst(m, ['💖', '✨', '💕'], 'float');
          sound(m, 'meow');
          await m.hop(32);
          await m.hop(24);
          await m.wait(1800);
          m.face('normal');
        });
        if (e.kind === 'partner') window.setTimeout(() => void visitRef.current(true), 2500);
      }),
    ];
    // breaks: she gets playful
    let prev = useTimer.getState();
    const offTimer = useTimer.subscribe((t) => {
      if (t.mode !== 'focus' && t.status === 'running' && !(prev.mode === t.mode && prev.status === 'running')) {
        void react(m, async (_t, m) => {
          m.face('happy');
          ctx.say(m, pick(L.BREAK_START), 3600);
          await m.hop(24);
          m.face('normal');
        });
      }
      prev = t;
    });
    return () => {
      offs.forEach((o) => o());
      offTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- every frame: move bodies, props and everything that floats over them ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastHitCheck = 0;
    const loop = (now: number) => {
      if (now - lastHitCheck > 250) {
        lastHitCheck = now;
        for (const b of bodies()) clickThrough(b);
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const b of bodies()) {
        try {
          b.update(dt, now);
        } catch (e) {
          console.error('[floww] cat frame failed', e);
          continue;
        }
        const h = b.head(16);
        const s = speechEls.current.get(b.id);
        if (s) {
          const w = s.offsetWidth;
          const hh = s.offsetHeight;
          const below = h.y - hh < 8;
          const x = clamp(h.x - w / 2, 8, innerWidth - w - 8);
          s.style.transform = `translate3d(${x}px, ${below ? b.y + 10 : h.y - hh}px, 0)`;
          s.style.setProperty('--tail', `${clamp(h.x - x, 16, w - 16)}px`);
          s.dataset.below = below ? '1' : '';
        }
        const e = emoteEls.current.get(b.id);
        if (e) {
          // beside her head, on the side away from the card
          const side = b === mom.current && cardOpen.current && cardSide.current > 0 ? -1 : 1;
          e.style.transform = `translate3d(${h.x + side * b.W * 0.26 - 16}px, ${h.y - 8}px, 0)`;
        }
        const cl = cloudEls.current.get(b.id);
        if (cl) cl.style.transform = `translate3d(${h.x - 20}px, ${h.y - 26}px, 0)`;
      }
      for (const t of things.current.values()) {
        try {
          t.update(dt);
        } catch {
          /* a prop glitch never stops the cats */
        }
      }
      if (tagEl.current && tag) {
        const b = kitBodies.current.get(tag);
        if (b) {
          const h = b.head(10);
          tagEl.current.style.transform = `translate3d(${h.x - tagEl.current.offsetWidth / 2}px, ${h.y - tagEl.current.offsetHeight}px, 0)`;
        }
      }
      placeCard();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  /**
   * Standing in front of a button, a cat lets clicks through to it: the timer's controls always win
   * over petting. Anywhere else she can be petted and picked up as usual.
   */
  const clickThrough = (b: Body) => {
    const el = hitEls.current.get(b.id);
    if (!el || b.dragging) return;
    const r = el.getBoundingClientRect();
    let blocked = false;
    for (const [fx, fy] of [[0.5, 0.25], [0.5, 0.55], [0.5, 0.85], [0.2, 0.5], [0.8, 0.5]]) {
      for (const under of document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy)) {
        if (under.closest('[data-cat-layer]')) continue;
        if (under.closest('button, a[href], input, textarea, select, [role="button"], [role="tab"], [role="switch"], [role="slider"]')) blocked = true;
        break;
      }
      if (blocked) break;
    }
    el.style.pointerEvents = blocked ? 'none' : 'auto';
  };

  /** The info card sits beside her (never over what she's saying) and follows her */
  const cardSide = useRef(1);
  const placeCard = () => {
    const el = cardEl.current;
    if (!el) return;
    const m = mom.current;
    const c = m.centre();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = m.W * 0.3 + 10;
    const right = c.x + gap + w < innerWidth - 8;
    cardSide.current = right ? 1 : -1;
    const x = right ? c.x + gap : Math.max(8, c.x - gap - w);
    const y = clamp(c.y - h / 2, 8, innerHeight - h - 8);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  /* ---------------- touching cats ---------------- */
  const hoverIn = useRef(0);
  const hoverOut = useRef(0);
  const cardOpenedAt = useRef(0);
  const openCard = (open: boolean) => {
    if (open === cardOpen.current) return;
    if (open) cardOpenedAt.current = performance.now();
    setCard(open);
    const m = mom.current;
    if (open && !m.dragging) {
      // she holds still and looks at you while you read about her
      void react(m, async (_t, m) => {
        m.anim(m.view.anim === 'slide' ? 'slide' : 'idle', m.view.anim === 'slide' ? { frame: 9 } : {});
        m.flip = pointer.x < m.x;
        m.face('happy');
        while (cardOpen.current) await sleep(300);
        m.face('normal');
      });
    }
  };

  const pet = (b: Body) => {
    if (b === mom.current) {
      const res = useCat.getState().pet();
      void react(b, async (tok, b) => {
        if (res === 'annoyed') return annoyed(ctx, b, tok);
        b.face('love');
        b.bob = 'purr';
        ctx.burst(b, ['💕', '❤️'], 'float');
        if (useCat.getState().purrs) sound(b, 'purr');
        else sound(b, 'meow');
        if (Math.random() < 0.4) ctx.say(b, pick(L.PET), 2600);
        await b.wait(1600);
        b.bob = 'breathe';
        b.face('normal');
      });
    } else {
      void react(b, async (tok, b) => {
        if (Math.random() < 0.5) await happy(ctx, b, tok);
        else {
          b.face('love');
          ctx.burst(b, ['💕'], 'float');
          sound(b, 'meow');
          ctx.say(b, pick(L.KITTEN), 1600);
          await b.hop(20);
          b.face('normal');
        }
      });
    }
  };

  const handlers = (b: Body) => {
    let down: { x: number; y: number; t: number; drag: boolean; vx: number; lx: number; lt: number; long: number } | null = null;
    const isMom = b === mom.current;
    return {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        down = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false, vx: 0, lx: e.clientX, lt: performance.now(), long: 0 };
        // a click means petting, not reading her card
        clearTimeout(hoverIn.current);
        // touch has no hover: a long press opens her card
        if (isMom && e.pointerType !== 'mouse') down.long = window.setTimeout(() => down && !down.drag && openCard(true), 450);
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        if (!down) return;
        if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
          down.drag = true;
          clearTimeout(down.long);
          if (isMom) openCard(false);
          b.interrupt();
          b.reacting = true;
          b.dragging = true;
          b.ground = { kind: 'air' };
          b.anim('fall');
          b.face('happy');
          if (Math.random() < 0.5) ctx.say(b, pick(['Wheee! 😸', 'Where are we going? 👀', 'Mrrp?!']), 1600);
        }
        if (down.drag) {
          const now = performance.now();
          down.vx = (e.clientX - down.lx) / Math.max(8, now - down.lt);
          down.lx = e.clientX;
          down.lt = now;
          b.x = clamp(e.clientX, b.foot * 0.5, innerWidth - b.foot * 0.5);
          b.y = clamp(e.clientY + b.H * 0.55, b.H, floorY());
          b.rot = clamp(down.vx * 22, -28, 28);
          if (Math.abs(down.vx) > 0.15) b.flip = down.vx < 0;
        }
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        if (!down) return;
        const d = down;
        down = null;
        clearTimeout(d.long);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (!d.drag) {
          if (performance.now() - d.t < 450) pet(b);
          return;
        }
        b.dragging = false;
        b.reacting = false;
        void react(b, async (_t, b) => {
          const from = b.y;
          await b.fall();
          if (b.y - from > 260) {
            b.anim('hurt', { loop: false });
            ctx.emote(b, '💫', 1200);
            await b.wait(800);
          } else b.face('happy');
          b.anim('idle');
          await b.wait(400);
          b.face('normal');
        });
      },
      onPointerCancel: () => {
        if (!down) return;
        clearTimeout(down.long);
        down = null;
        if (b.dragging) {
          b.dragging = false;
          b.reacting = false;
          void react(b, (_t, me) => me.fall());
        }
      },
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        if (!isMom) return setTag(b.id);
        clearTimeout(hoverOut.current);
        hoverIn.current = window.setTimeout(() => !b.dragging && openCard(true), 650);
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        if (!isMom) return setTag((t) => (t === b.id ? null : t));
        clearTimeout(hoverIn.current);
        hoverOut.current = window.setTimeout(() => openCard(false), 380);
      },
    };
  };
  const handlerCache = useRef(new Map<string, ReturnType<typeof handlers>>());
  const handlersFor = (b: Body) => {
    let h = handlerCache.current.get(b.id);
    if (!h) handlerCache.current.set(b.id, (h = handlers(b)));
    return h;
  };

  if (zen) return null;

  const all = bodies();
  const skinFor = (b: Body): SkinId => (b === mom.current ? skin : b.id === 'partner' ? (partner?.skin ?? 'tabby') : (kittens.find((k) => `k:${k.id}` === b.id)?.skin ?? 'tabby'));
  const nameFor = (b: Body) => (b === mom.current ? name : b.id === 'partner' ? (partner?.name ?? '') : (kittens.find((k) => `k:${k.id}` === b.id)?.name ?? ''));
  const lv = levelOf(xp);
  const prog = levelProgress(xp);
  const next = nextMilestone(cat);
  void visiting;
  void H;

  return (
    <>
      {/* the cats and their props */}
      <div data-cat-layer className="pointer-events-none fixed inset-0 z-[35] overflow-hidden select-none" style={{ opacity: ready ? 1 : 0, transition: 'opacity .6s' }}>
        {shown.boxBack !== undefined && <BoxPart part="back" H={mom.current.H} thing={things.current.get('boxBack')} />}
        {all.map((b) => {
          const v = views[b.id] ?? b.view;
          const tint = tints[b.id];
          return (
            <div
              key={b.id}
              ref={(el) => {
                b.el = el;
                b.paint();
              }}
              className="absolute top-0 left-0 will-change-transform"
              style={{ width: b.W, height: b.H, zIndex: b === mom.current ? 3 : 2 }}
            >
              <CatSprite
                anim={v.anim}
                face={v.face}
                frame={v.frame}
                loop={v.loop ?? true}
                skin={skinFor(b)}
                height={b.H}
                fps={b.id.startsWith('k:') ? 14 : 12}
                style={tint ? { filter: tint === 'sad' ? 'saturate(.55) brightness(.95)' : 'drop-shadow(0 0 7px rgb(255 70 70 / .75)) drop-shadow(0 0 2px rgb(255 70 70 / .6))' } : undefined}
              />
              {b === mom.current && (
                <AnimatePresence>
                  {crown && (
                    <motion.span
                      initial={{ opacity: 0, y: -16, scale: 0.4 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      className="absolute text-center leading-none"
                      style={{ left: b.W * 0.47 - b.H * 0.11, top: b.H * 0.02, fontSize: b.H * 0.22, width: b.H * 0.22 }}
                    >
                      👑
                    </motion.span>
                  )}
                </AnimatePresence>
              )}
              {/* only her body catches the pointer, not the empty corners of the sprite */}
              <div
                {...handlersFor(b)}
                ref={(el) => void (el ? hitEls.current.set(b.id, el) : hitEls.current.delete(b.id))}
                role="button"
                tabIndex={b === mom.current ? 0 : -1}
                aria-label={b === mom.current ? `${name} the cat, feeling ${mood}. Click to pet, drag to move` : `${nameFor(b)}, a kitten`}
                onKeyDown={(e) => e.key === 'Enter' && pet(b)}
                className="pointer-events-auto absolute cursor-grab touch-none rounded-[40%] outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
                style={{ left: b.W * (FEET.x - 0.22), top: b.H * 0.12, width: b.W * 0.44, height: b.H * 0.85 }}
              />
            </div>
          );
        })}
        {shown.boxFront !== undefined && <BoxPart part="front" H={mom.current.H} thing={things.current.get('boxFront')} />}
        {(['bowl', 'yarn', 'item', 'gift', 'butterfly'] as const).map(
          (k) =>
            shown[k] !== undefined && (
              <div
                key={k}
                ref={(el) => {
                  const t = things.current.get(k);
                  if (t) {
                    t.el = el;
                    t.update(0);
                  }
                }}
                onClick={
                  k === 'gift'
                    ? () => {
                        const t = things.current.get('gift');
                        ctx.hide('gift');
                        useCat.setState((s) => ({ joy: Math.min(100, s.joy + 8), affection: Math.min(100, s.affection + 3) }));
                        void react(mom.current, async (_t, me) => {
                          me.face('love');
                          ctx.say(me, 'You like it?? 😻', 2600);
                          if (t) setParticles((p) => [...p, ...['💖', '✨', '💕'].map((text) => ({ id: seq++, text, kind: 'float' as const, x: t.x, y: t.y - 30, dx: rand(-30, 30) }))]);
                          await me.hop(28);
                          me.face('normal');
                        });
                      }
                    : undefined
                }
                className={k === 'gift' ? 'pointer-events-auto absolute top-0 left-0 cursor-pointer' : 'absolute top-0 left-0'}
                style={{ zIndex: 4 }}
              >
                <Prop kind={k} emoji={shown[k]!} H={mom.current.H} />
              </div>
            ),
        )}
      </div>

      {/* everything that floats over them: bubbles, emotes, particles, the info card */}
      <div data-cat-layer className="pointer-events-none fixed inset-0 z-[55] overflow-hidden select-none" style={{ opacity: ready ? 1 : 0 }}>
        {all.map((b) => {
          const s = speech[b.id];
          const hideForCard = b === mom.current && card;
          return (
            <React.Fragment key={b.id}>
              <AnimatePresence>
                {s && !hideForCard && (
                  <motion.div
                    key={s.id}
                    ref={(el: HTMLDivElement | null) => void (el ? speechEls.current.set(b.id, el) : speechEls.current.delete(b.id))}
                    className="absolute top-0 left-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                  >
                    <motion.div
                      initial={{ scale: 0.6, y: 8 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                      className={`cat-bubble glass-strong relative w-max rounded-2xl px-3.5 py-2 text-center font-bold text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] ${b.id.startsWith('k:') ? 'max-w-[160px] text-[12px]' : 'max-w-[250px] text-[13.5px]'}`}
                    >
                      {s.text}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {emotes[b.id] && (
                  <motion.div
                    key={emotes[b.id].id}
                    ref={(el: HTMLDivElement | null) => void (el ? emoteEls.current.set(b.id, el) : emoteEls.current.delete(b.id))}
                    className="absolute top-0 left-0"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.3, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: -12 }}
                      exit={{ opacity: 0, scale: 0.5, y: -26 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                      className="glass-strong grid size-8 place-items-center rounded-full text-[17px] shadow-md"
                    >
                      {emotes[b.id].emoji}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {clouds[b.id] && (
                  <motion.div
                    key="cloud"
                    ref={(el: HTMLDivElement | null) => void (el ? cloudEls.current.set(b.id, el) : cloudEls.current.delete(b.id))}
                    className="absolute top-0 left-0 text-[30px] leading-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.span className="block" animate={{ x: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity }}>
                      🌧️
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}

        <AnimatePresence>
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className={`absolute top-0 left-0 font-display font-black ${p.kind === 'z' ? 'text-base text-muted' : p.text === 'nom' ? 'rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-accent-ink' : 'text-lg'}`}
              initial={{ x: p.x, y: p.y, opacity: 0.95, scale: 0.6 }}
              animate={
                p.kind === 'drop'
                  ? { x: p.x, y: p.y + 70, opacity: 0, scale: 1 }
                  : p.kind === 'z'
                    ? { x: p.x + 26, y: p.y - 46, opacity: 0, scale: 1.3 }
                    : { x: p.x + p.dx, y: p.y - 60, opacity: 0, scale: p.kind === 'spark' ? 1.3 : 1.1, rotate: p.kind === 'note' ? [0, -15, 15] : 0 }
              }
              transition={{ duration: p.kind === 'drop' ? 0.7 : 1.5, ease: 'easeOut' }}
            >
              {p.text}
            </motion.span>
          ))}
        </AnimatePresence>

        {tag && (
          <div ref={(el) => void (tagEl.current = el)} className="glass-strong absolute top-0 left-0 rounded-full px-2.5 py-1 text-[11px] font-black text-ink shadow-md">
            🐾 {nameFor(kitBodies.current.get(tag) ?? mom.current)}
          </div>
        )}

        <AnimatePresence>
          {card && (
            <motion.div
              key="card"
              ref={(el: HTMLDivElement | null) => {
                cardEl.current = el;
                placeCard();
              }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ duration: 0.18 }}
              onPointerEnter={() => clearTimeout(hoverOut.current)}
              // a long press opens the card under the finger: the lift that follows must not press a button in it
              onClickCapture={(e) => performance.now() - cardOpenedAt.current < 600 && (e.stopPropagation(), e.preventDefault())}
              onPointerLeave={(e) => e.pointerType === 'mouse' && (hoverOut.current = window.setTimeout(() => openCard(false), 380))}
              className="glass-strong pointer-events-auto absolute top-0 left-0 w-[248px] rounded-3xl p-3.5 text-ink shadow-[0_18px_50px_-18px_rgb(0_0_0/0.45)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display truncate text-base font-bold">{name}</span>
                <span className="flex items-center gap-1 text-xs font-bold text-muted capitalize">
                  {MOOD_FACE[mood]} {mood}
                </span>
                <button onClick={() => openCard(false)} aria-label="Close" className="pressable grid size-6 shrink-0 place-items-center rounded-full bg-line text-xs font-black md:hidden">
                  ✕
                </button>
              </div>
              {speech.mom && <p className="mt-2 rounded-2xl bg-accent-soft px-3 py-1.5 text-[12.5px] font-bold">💬 {speech.mom.text}</p>}

              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] font-black text-muted">
                  <span>
                    💞 Bond lv {lv}
                    {lv >= MAX_LEVEL && ' (max!)'}
                  </span>
                  {prog.need > 0 && <span>{prog.need} to go</span>}
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-secondary transition-[width] duration-500" style={{ width: `${prog.pct * 100}%` }} />
                </div>
                {next && <p className="mt-1 text-[11px] font-bold text-muted">{next}</p>}
              </div>

              <div className="mt-2.5 space-y-1.5 text-[11px] font-bold text-muted">
                {(
                  [
                    ['🍗 Full', 100 - hunger],
                    ['⚡ Energy', energy],
                    ['💖 Happy', joy],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${clamp(v, 0, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {kittens.length > 0 && <p className="mt-2 truncate text-[11px] font-bold text-muted">🐾 Kittens: {kittens.map((k) => k.name).join(', ')}</p>}

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Skins">
                {SKINS.map((s) => {
                  const ok = unlocked(s.id, xp);
                  return (
                    <button
                      key={s.id}
                      title={ok ? s.name : `${s.name}: unlocks at bond level ${s.unlock}`}
                      aria-label={ok ? `Skin: ${s.name}` : `${s.name}, locked`}
                      disabled={!ok}
                      onClick={() => useCat.getState().setSkin(s.id)}
                      className="pressable relative grid size-6 place-items-center rounded-full text-[10px] disabled:opacity-40"
                      style={{
                        background: s.ramp ? `linear-gradient(135deg, ${s.ramp[2]}, ${s.ramp[0]})` : 'linear-gradient(135deg,#8a8a8a,#3a3a3a)',
                        boxShadow: skin === s.id ? '0 0 0 2px var(--surface-strong), 0 0 0 4px var(--accent)' : undefined,
                      }}
                    >
                      {!ok && '🔒'}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                <span className="text-xs font-black">🐟 × {treats}</span>
                <button
                  type="button"
                  disabled={treats === 0}
                  onClick={() => {
                    openCard(false);
                    void react(mom.current, (tok, me) => eat(ctx, me, tok));
                  }}
                  className="pressable rounded-xl bg-accent px-2.5 py-1 text-[11px] font-extrabold text-accent-ink disabled:pointer-events-none disabled:opacity-45"
                >
                  {treats === 0 ? 'Focus to earn 🐟' : 'Feed 🐟'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */
function Prop({ kind, emoji, H }: { kind: 'bowl' | 'yarn' | 'item' | 'gift' | 'butterfly'; emoji: string; H: number }) {
  const s = H / 154;
  if (kind === 'bowl')
    return (
      <div className="flex flex-col items-center" style={{ width: 54 * s }}>
        <span style={{ fontSize: 22 * s, lineHeight: 1, marginBottom: -4 * s }}>🐟</span>
        <div className="rounded-t-md rounded-b-[999px] bg-accent shadow-md ring-2 ring-white/50" style={{ width: 54 * s, height: 20 * s }} />
      </div>
    );
  if (kind === 'yarn') return <span style={{ fontSize: 30 * s, lineHeight: 1, display: 'block' }}>🧶</span>;
  if (kind === 'butterfly')
    return (
      <motion.span className="block" style={{ fontSize: 28 * s, lineHeight: 1 }} animate={{ scaleX: [1, 0.35, 1] }} transition={{ duration: 0.28, repeat: Infinity }}>
        🦋
      </motion.span>
    );
  if (kind === 'gift')
    return (
      <span className="relative block" style={{ fontSize: 30 * s, lineHeight: 1 }}>
        {emoji}
        <motion.span className="absolute -top-2 -right-3 text-sm" animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.6] }} transition={{ duration: 1.4, repeat: Infinity }}>
          ✨
        </motion.span>
      </span>
    );
  return <span style={{ fontSize: 30 * s, lineHeight: 1, display: 'block' }}>{emoji}</span>;
}

/** A cardboard box in two layers, so she can sit *inside* it */
function BoxPart({ part, H, thing }: { part: 'back' | 'front'; H: number; thing?: Thing }) {
  const w = H * 0.62;
  return (
    <div
      ref={(el) => {
        if (thing) {
          thing.el = el;
          thing.update(0);
        }
      }}
      className="absolute top-0 left-0"
      style={{ zIndex: part === 'back' ? 1 : 4 }}
    >
      {part === 'back' ? (
        <div style={{ width: w, height: H * 0.5 }} className="relative">
          <div className="absolute inset-x-0 bottom-0 rounded-md bg-[#b98552]" style={{ height: H * 0.42 }} />
          <div className="absolute top-0 left-[6%] h-[30%] w-[44%] origin-bottom-right -skew-x-12 rounded-sm bg-[#a87445]" />
          <div className="absolute top-0 right-[6%] h-[30%] w-[44%] origin-bottom-left skew-x-12 rounded-sm bg-[#a87445]" />
        </div>
      ) : (
        <div style={{ width: w, height: H * 0.36 }} className="relative overflow-hidden rounded-md bg-[#d29a62] shadow-[inset_0_6px_0_rgb(0_0_0/0.12)]">
          <div className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2 bg-[#e9c08f]/70" />
          <span className="absolute right-[10%] bottom-[12%] text-[10px] font-black text-[#7a4e25]/70">FRAGILE ♡</span>
        </div>
      )}
    </div>
  );
}
