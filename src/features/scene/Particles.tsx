import { useEffect, useRef } from 'react';
import { usePrefs, type EffectId } from '@/store/prefs';
import { prefersReducedMotion } from '@/lib/utils';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  a: number;
  r: number;
  vr: number;
  ph: number;
}

const BASE: Record<EffectId, number> = { snow: 110, rain: 160, sakura: 34, fireflies: 38, stars: 140, bubbles: 26 };

function spawn(kind: EffectId, w: number, h: number, initial: boolean): P {
  const rnd = Math.random;
  const y = initial ? rnd() * h : -20;
  switch (kind) {
    case 'snow':
      return { x: rnd() * w, y, vx: 0, vy: 0.4 + rnd() * 1.1, s: 1 + rnd() * 3.2, a: 0.5 + rnd() * 0.5, r: 0, vr: 0, ph: rnd() * 6.28 };
    case 'rain':
      return { x: rnd() * (w + 200) - 100, y: initial ? rnd() * h : -40 - rnd() * 100, vx: -1.6, vy: 11 + rnd() * 7, s: 10 + rnd() * 16, a: 0.18 + rnd() * 0.3, r: 0, vr: 0, ph: 0 };
    case 'sakura':
      return { x: rnd() * w, y, vx: 0.3 + rnd() * 0.6, vy: 0.6 + rnd() * 0.9, s: 6 + rnd() * 7, a: 0.75 + rnd() * 0.25, r: rnd() * 6.28, vr: (rnd() - 0.5) * 0.04, ph: rnd() * 6.28 };
    case 'fireflies':
      return { x: rnd() * w, y: h * (0.25 + rnd() * 0.75), vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.4, s: 1.5 + rnd() * 2.2, a: 0, r: 0, vr: 0, ph: rnd() * 6.28 };
    case 'stars':
      return { x: rnd() * w, y: rnd() * h * 0.85, vx: 0, vy: 0, s: 0.4 + rnd() * 1.4, a: rnd(), r: 0, vr: 0, ph: rnd() * 6.28 };
    case 'bubbles':
      return { x: rnd() * w, y: initial ? rnd() * h : h + 30, vx: 0, vy: -(0.35 + rnd() * 0.8), s: 5 + rnd() * 16, a: 0.25 + rnd() * 0.35, r: 0, vr: 0, ph: rnd() * 6.28 };
  }
}

export function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  const effects = usePrefs((s) => s.effects);
  const density = usePrefs((s) => s.effectDensity);
  const active = (Object.keys(effects) as EffectId[]).filter((k) => effects[k]);
  const key = active.join(',') + density;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active.length) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      w = innerWidth;
      h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);

    const areaK = Math.min(1.4, (innerWidth * innerHeight) / (1440 * 900));
    const pools = active.map((kind) => ({
      kind,
      ps: Array.from({ length: Math.round(BASE[kind] * density * Math.max(0.45, areaK)) }, () => spawn(kind, w, h, true)),
    }));

    // pre-render a sakura petal sprite
    const petal = document.createElement('canvas');
    petal.width = petal.height = 32;
    const pc = petal.getContext('2d')!;
    const g = pc.createLinearGradient(0, 0, 32, 32);
    g.addColorStop(0, '#ffe4ee');
    g.addColorStop(1, '#ff9fc0');
    pc.fillStyle = g;
    pc.beginPath();
    pc.moveTo(16, 2);
    pc.bezierCurveTo(30, 8, 28, 26, 16, 30);
    pc.bezierCurveTo(4, 26, 2, 8, 16, 2);
    pc.fill();

    const still = prefersReducedMotion();
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const pointer = { x: -9999, y: -9999 };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    addEventListener('pointermove', onMove, { passive: true });

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      t += 0.016 * dt;
      ctx.clearRect(0, 0, w, h);
      for (const { kind, ps } of pools) {
        for (const p of ps) {
          if (!still) {
            switch (kind) {
              case 'snow':
                p.x += Math.sin(t * 1.2 + p.ph) * 0.4 * dt;
                p.y += p.vy * dt;
                break;
              case 'sakura':
                p.x += (p.vx + Math.sin(t * 1.5 + p.ph) * 0.8) * dt;
                p.y += p.vy * dt;
                p.r += p.vr * dt;
                break;
              case 'fireflies':
                p.vx += (Math.random() - 0.5) * 0.05;
                p.vy += (Math.random() - 0.5) * 0.05;
                p.vx *= 0.98;
                p.vy *= 0.98;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.a = 0.5 + 0.5 * Math.sin(t * 2 + p.ph);
                break;
              case 'stars':
                p.a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + p.ph));
                break;
              case 'bubbles':
                p.x += Math.sin(t + p.ph) * 0.5 * dt;
                p.y += p.vy * dt;
                break;
              default:
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
            // gentle push away from the pointer (snow, petals, bubbles)
            if (kind === 'snow' || kind === 'sakura' || kind === 'bubbles') {
              const dx = p.x - pointer.x, dy = p.y - pointer.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 9000) {
                const f = (1 - d2 / 9000) * 1.6;
                p.x += (dx / Math.sqrt(d2 + 1)) * f;
                p.y += (dy / Math.sqrt(d2 + 1)) * f * 0.5;
              }
            }
            if (p.y > h + 30 || p.x > w + 120 || p.x < -120 || (kind === 'bubbles' && p.y < -40)) Object.assign(p, spawn(kind, w, h, false));
            if (kind === 'fireflies' && (p.y < 0 || p.y > h)) p.vy *= -1;
          }

          switch (kind) {
            case 'snow':
              ctx.globalAlpha = p.a;
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.s, 0, 6.283);
              ctx.fill();
              break;
            case 'rain':
              ctx.globalAlpha = p.a;
              ctx.strokeStyle = '#cfe6ff';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x + p.vx * 1.6, p.y + p.s);
              ctx.stroke();
              break;
            case 'sakura':
              ctx.globalAlpha = p.a;
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(p.r);
              ctx.scale(1, 0.6 + 0.4 * Math.sin(t * 3 + p.ph));
              ctx.drawImage(petal, -p.s / 2, -p.s / 2, p.s, p.s);
              ctx.restore();
              break;
            case 'fireflies': {
              ctx.globalAlpha = p.a;
              const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 6);
              gr.addColorStop(0, 'rgba(255,240,150,1)');
              gr.addColorStop(0.3, 'rgba(255,220,90,.5)');
              gr.addColorStop(1, 'rgba(255,200,60,0)');
              ctx.fillStyle = gr;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.s * 6, 0, 6.283);
              ctx.fill();
              break;
            }
            case 'stars':
              ctx.globalAlpha = p.a;
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.s, 0, 6.283);
              ctx.fill();
              break;
            case 'bubbles':
              ctx.globalAlpha = p.a;
              ctx.strokeStyle = 'rgba(255,255,255,.9)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.s, 0, 6.283);
              ctx.stroke();
              ctx.fillStyle = 'rgba(255,255,255,.5)';
              ctx.beginPath();
              ctx.arc(p.x - p.s * 0.35, p.y - p.s * 0.35, p.s * 0.22, 0, 6.283);
              ctx.fill();
              break;
          }
        }
      }
      // occasional shooting star
      if (effects.stars && !still && Math.random() < 0.003) shooting.push({ x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.3, life: 1 });
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life -= 0.02 * dt;
        s.x -= 9 * dt;
        s.y += 4 * dt;
        ctx.globalAlpha = Math.max(0, s.life);
        const lg = ctx.createLinearGradient(s.x, s.y, s.x + 90, s.y - 40);
        lg.addColorStop(0, '#fff');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + 90, s.y - 40);
        ctx.stroke();
        if (s.life <= 0) shooting.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      if (still) cancelAnimationFrame(raf);
    };
    const shooting: { x: number; y: number; life: number }[] = [];
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible') {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, w, h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!active.length) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[1] size-full" aria-hidden />;
}
