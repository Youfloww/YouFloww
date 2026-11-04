import type { UserData } from '@/data/types';
import { deriveStats } from '@/data/model';
import { formatDuration, keyToDate, lastNDays } from '@/lib/time';
import { useCat } from '@/features/cat/brain';
import { stripUrl } from '@/features/cat/skins';

const W = 1080;
const H = 1920;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const DISPLAY = '"Fredoka Variable", sans-serif';
const BODY = '"Nunito Variable", sans-serif';

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number]
) {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/** Mixes two 'rgba(r,g,b,a)' colours, t from 0 to 1. */
function mix(c0: string, c1: string, t: number) {
  const p = (c: string) => c.match(/[\d.]+/g)!.map(Number);
  const [a, b] = [p(c0), p(c1)];
  const v = a.map((x, i) => x + (b[i] - x) * t);
  return `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${v[3].toFixed(3)})`;
}

function setLS(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  }
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  makeFont: (px: number) => string,
  maxPx: number,
  maxWidth: number
): number {
  let px = maxPx;
  ctx.font = makeFont(px);
  const m = ctx.measureText(text).width;
  if (m > maxWidth && m > 0) {
    px = Math.max(16, Math.floor((px * maxWidth) / m));
    ctx.font = makeFont(px);
  }
  return px;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function drawSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  const ir = r * 0.22;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : ir;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Renders a 1080×1920 story-sized "Floww Wrap" PNG: dark, neon aurora, glowing hero number and the user's own cat. */
export async function renderShareCard(d: UserData): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font readiness failure
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Background + Blurred Aurora + Vignette + Film Grain
  ctx.fillStyle = '#07060B';
  ctx.fillRect(0, 0, W, H);

  // Aurora: soft ribbons blurred with the shadow trick (draw the stroke off-canvas, keep only its shadow;
  // ctx.filter isn't in Safari), on a quarter-size canvas that is then scaled up.
  const aw = 270;
  const ah = 480;
  const off = document.createElement('canvas');
  off.width = aw;
  off.height = ah;
  const octx = off.getContext('2d')!;
  octx.lineCap = 'round';
  const ribbon = (stops: [number, string][], width: number, blur: number, path: (c: CanvasRenderingContext2D) => void) => {
    octx.save();
    octx.translate(-2000, 0);
    octx.shadowOffsetX = 2000;
    octx.shadowBlur = blur;
    octx.strokeStyle = '#fff';
    octx.lineWidth = width;
    // the shadow takes the stroke's colour only from shadowColor, so draw it in slices along x
    for (let x = 0; x < aw; x += 6) {
      const t = x / aw;
      let col = stops[0][1];
      for (let i = 0; i < stops.length - 1; i++) {
        const [a0, c0] = stops[i];
        const [a1, c1] = stops[i + 1];
        if (t >= a0 && t <= a1) col = mix(c0, c1, (t - a0) / (a1 - a0));
      }
      octx.save();
      octx.beginPath();
      octx.rect(x + 2000, -50, 6, ah + 100); // slices meet exactly: overlaps would show as stripes
      octx.clip();
      octx.shadowColor = col;
      octx.beginPath();
      path(octx);
      octx.stroke();
      octx.restore();
    }
    octx.restore();
  };
  // main sweep: peach from the left, dipping pink through the middle, rising violet to the right
  ribbon([[0, 'rgba(255,192,108,.85)'], [0.5, 'rgba(255,118,169,.9)'], [1, 'rgba(138,92,246,.85)']], 34, 26, (c) => {
    c.moveTo(-40, ah * 0.2);
    c.bezierCurveTo(aw * 0.3, ah * 0.46, aw * 0.66, ah * 0.4, aw + 40, ah * 0.2);
  });
  // its hot core, so the sweep glows instead of just tinting the dark
  ribbon([[0, 'rgba(255,210,140,.95)'], [0.5, 'rgba(255,140,190,1)'], [1, 'rgba(170,130,255,.95)']], 12, 12, (c) => {
    c.moveTo(-40, ah * 0.2);
    c.bezierCurveTo(aw * 0.3, ah * 0.46, aw * 0.66, ah * 0.4, aw + 40, ah * 0.2);
  });
  // a fainter echo just under it
  ribbon([[0, 'rgba(255,118,169,.45)'], [0.6, 'rgba(138,92,246,.5)'], [1, 'rgba(138,92,246,.35)']], 20, 30, (c) => {
    c.moveTo(-40, ah * 0.34);
    c.bezierCurveTo(aw * 0.35, ah * 0.52, aw * 0.7, ah * 0.46, aw + 40, ah * 0.3);
  });

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'lighter'; // twice, added: light on black, not a tint
  ctx.drawImage(off, 0, 0, W, H);
  ctx.globalAlpha = 0.6;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.restore();

  // Soft radial glow behind hero number
  const heroBgGlow = ctx.createRadialGradient(W / 2, 460, 20, W / 2, 460, 480);
  heroBgGlow.addColorStop(0, 'rgba(255, 118, 169, 0.28)');
  heroBgGlow.addColorStop(0.45, 'rgba(138, 92, 246, 0.18)');
  heroBgGlow.addColorStop(1, 'rgba(7, 6, 11, 0)');
  ctx.fillStyle = heroBgGlow;
  ctx.fillRect(0, 0, W, 1000);

  // Dark vignette at edges
  const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.65);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 200x200 noise tile pattern
  const nCanvas = document.createElement('canvas');
  nCanvas.width = 200;
  nCanvas.height = 200;
  const nctx = nCanvas.getContext('2d')!;
  const imgData = nctx.createImageData(200, 200);
  const buf = imgData.data;
  for (let i = 0; i < buf.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    buf[i] = v;
    buf[i + 1] = v;
    buf[i + 2] = v;
    buf[i + 3] = 255;
  }
  nctx.putImageData(imgData, 0, 0);
  const pattern = ctx.createPattern(nCanvas, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 2. Top pill centred at y=130
  const now = new Date();
  const monthYear = now
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
  const pillText = `FLOWW WRAP · ${monthYear}`;
  ctx.save();
  ctx.font = `600 30px ${MONO}`;
  setLS(ctx, 3);
  const ptW = ctx.measureText(pillText).width;
  const dotR = 9;
  const dotGap = 20;
  const padX = 36;
  const contentW = dotR * 2 + dotGap + ptW;
  const pillW = contentW + padX * 2;
  const pillH = 64;
  const pillX = (W - pillW) / 2;
  const pillY = 130 - pillH / 2;

  rr(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  const dotX = pillX + padX + dotR;
  const dotY = 130;
  ctx.save();
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
  ctx.fillStyle = '#FF76A9';
  ctx.shadowColor = '#FF76A9';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(pillText, dotX + dotR + dotGap, 131);
  setLS(ctx, 0);
  ctx.restore();

  // 3. Title y=250
  const rawName = (d.profileName || '').trim();
  const firstWord = rawName.split(/\s+/)[0] || '';
  const titleText =
    !rawName || rawName.toLowerCase() === 'floww user'
      ? 'My Focus Era'
      : `${firstWord}'s Focus Era`;
  ctx.save();
  fitFont(ctx, titleText, (px) => `600 ${px}px ${BODY}`, 52, 920);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titleText, W / 2, 250);
  ctx.restore();

  // 4. Hero y=540 baseline
  const hours = (d.totalFocusSeconds || 0) / 3600;
  const heroStr = `${hours >= 100 ? Math.round(hours) : hours.toFixed(1)}h`;
  ctx.save();
  const heroPx = fitFont(ctx, heroStr, (px) => `700 ${px}px ${DISPLAY}`, 330, 940);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const heroW = ctx.measureText(heroStr).width;
  const hGrad = ctx.createLinearGradient(W / 2 - heroW / 2, 0, W / 2 + heroW / 2, 0);
  hGrad.addColorStop(0, '#FFFFFF');
  hGrad.addColorStop(0.35, '#FFD9C2');
  hGrad.addColorStop(0.7, '#FF9CC6');
  hGrad.addColorStop(1, '#A98BFF');
  ctx.fillStyle = hGrad;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 118, 169, 0.65)';
  ctx.shadowBlur = 70;
  ctx.fillText(heroStr, W / 2, 540);
  ctx.restore();

  ctx.fillText(heroStr, W / 2, 540);
  drawSparkle(ctx, Math.min(W - 70, W / 2 + heroW / 2 + 24), 540 - heroPx * 0.68, 28);
  ctx.restore();

  // 5. 'OF DEEP FOCUS' y=630
  ctx.save();
  ctx.font = `700 46px ${BODY}`;
  setLS(ctx, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OF DEEP FOCUS', W / 2, 630);
  setLS(ctx, 0);
  ctx.restore();

  // 6. User's cat + floor glow + cat name
  const catState = useCat.getState();
  const skin = catState?.skin;
  const catName = catState?.name || 'Kitty';
  const catH = 380;
  const catW = (380 * 336) / 288;
  const catX = (W - catW) / 2;
  const catY = 680;

  // Floor ellipse glow under cat
  ctx.save();
  ctx.translate(W / 2, catY + catH - 18);
  ctx.scale(2.4, 0.55);
  const floorGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
  floorGlow.addColorStop(0, 'rgba(255, 118, 169, 0.52)');
  floorGlow.addColorStop(0.5, 'rgba(138, 92, 246, 0.28)');
  floorGlow.addColorStop(1, 'rgba(138, 92, 246, 0)');
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  try {
    const url = await stripUrl(skin, 'idle-happy');
    const img = await loadImage(url);
    ctx.save();
    let shadowCol = 'rgba(255, 118, 169, 0.55)';
    if (skin === 'golden') shadowCol = 'rgba(255, 200, 60, 0.6)';
    else if (skin === 'cosmic') shadowCol = 'rgba(150, 130, 255, 0.7)';

    ctx.shadowColor = shadowCol;
    ctx.shadowBlur = 50;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, 336, 288, catX, catY, catW, catH);
    ctx.restore();
  } catch {
    // Fallback silhouette if sprite fails to load
    ctx.save();
    ctx.fillStyle = 'rgba(255, 118, 169, 0.25)';
    ctx.beginPath();
    ctx.arc(W / 2, catY + catH / 2, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.font = `700 34px ${BODY}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`with ${catName} 🐾`, W / 2, 1105);
  ctx.restore();

  // 7. 2x2 glass tiles
  const { streak, weekSeconds } = deriveStats(d);
  const tiles: Array<[string, string, string]> = [
    ['🔥', `${streak}d`, 'Current streak'],
    ['👑', `${d.bestStreak || 0}d`, 'Best streak'],
    ['🎯', `${d.totalSessions || 0}`, 'Sessions'],
    ['🕒', formatDuration(weekSeconds || 0), 'This week'],
  ];

  const startX = 117;
  const startY = 1150;
  const tw = 410;
  const th = 180;
  const gap = 26;

  tiles.forEach(([emoji, val, label], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const tx = startX + col * (tw + gap);
    const ty = startY + row * (th + gap);

    ctx.save();
    rr(ctx, tx, ty, tw, th, 32);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();

    const hiGrad = ctx.createLinearGradient(tx, ty, tx, ty + th);
    hiGrad.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    hiGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = hiGrad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.font = `28px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(emoji, tx + tw - 34, ty + 38);

    fitFont(ctx, val, (px) => `600 ${px}px ${DISPLAY}`, 92, 300); // leaves room for the emoji
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(val, tx + tw / 2, ty + 102);

    ctx.font = `600 36px ${BODY}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, tx + tw / 2, ty + 150);
    ctx.restore();
  });

  // 8. Last 7 days bars
  const keys = lastNDays(7);
  const daily = d.dailyFocusSeconds || {};
  const vals = keys.map((k) => daily[k] || 0);
  const maxVal = Math.max(...vals, 1);
  const barW = 64;
  const baseY = 1765;
  const maxH = 160;

  keys.forEach((k, i) => {
    const cx = 200 + (i * (880 - 200)) / 6;
    const v = vals[i];
    const isZero = v <= 0;
    const isToday = i === keys.length - 1;
    const bh = isZero ? 6 : Math.max(10, Math.round((v / maxVal) * maxH));
    const bx = cx - barW / 2;
    const by = baseY - bh;

    ctx.save();
    if (isZero) ctx.globalAlpha = 0.35;

    const bGrad = ctx.createLinearGradient(0, by, 0, baseY);
    if (isToday && !isZero) {
      bGrad.addColorStop(0, '#FFD89B');
      bGrad.addColorStop(1, '#FF6EB0');
    } else {
      bGrad.addColorStop(0, '#FFC06C');
      bGrad.addColorStop(1, '#FF4F9A');
    }

    const rTop = Math.min(18, bh / 2);
    rr(ctx, bx, by, barW, bh, [rTop, rTop, 6, 6]);
    ctx.fillStyle = bGrad;
    if (!isZero) {
      ctx.shadowColor = 'rgba(255, 118, 169, 0.7)';
      ctx.shadowBlur = 35;
    }
    ctx.fill();

    if (isToday) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
    ctx.restore();

    const date = keyToDate(k);
    const dayLetter = date
      .toLocaleDateString('en-US', { weekday: 'narrow' })
      .toUpperCase();
    ctx.save();
    ctx.font = `700 30px ${BODY}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayLetter, cx, 1812);
    ctx.restore();
  });

  // 9. Footer y=1880
  ctx.save();
  ctx.font = `500 32px ${MONO}`;
  setLS(ctx, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('youfloww.vercel.app', W / 2, 1880);
  setLS(ctx, 0);
  ctx.restore();

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

export async function shareCard(d: UserData) {
  const blob = await renderShareCard(d);
  const file = new File([blob], 'floww-wrap.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Floww Wrap', text: 'Focusing with YouFloww 🫧 youfloww.vercel.app' });
      return 'shared';
    } catch {
      /* cancelled → fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'floww-wrap.png' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
