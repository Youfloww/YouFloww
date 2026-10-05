import type { UserData } from '@/data/types';
import { deriveStats } from '@/data/model';
import { formatDuration, keyToDate, lastNDays } from '@/lib/time';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

/** Renders a 1080×1920 story-sized "Floww Wrap" PNG. */
export async function renderShareCard(d: UserData): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => cs.getPropertyValue(k).trim() || '#ffffff';
  const dark = cs.getPropertyValue('color-scheme').includes('dark');
  const ink = dark ? '#ffffff' : v('--ink');
  await document.fonts.ready;
  const display = (px: number, w = 600) => `${w} ${px}px 'Fredoka Variable', Fredoka, sans-serif`;
  const body = (px: number, w = 800) => `${w} ${px}px 'Nunito Variable', Nunito, sans-serif`;

  // background: soft blobs
  ctx.fillStyle = v('--bg');
  ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, r: number, col: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(180, 260, 760, v('--a1'));
  blob(950, 520, 700, v('--a2'));
  blob(520, 1500, 900, v('--a3'));
  blob(980, 1800, 600, v('--a4'));

  // mascot
  try {
    const img = await loadImg('/favicon.svg');
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(img, W / 2 - 150, 150, 300, 300);
    ctx.restore();
  } catch {
    /* fine */
  }

  const s = deriveStats(d);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = display(96);
  ctx.fillText('My Floww Wrap', W / 2, 560);
  ctx.globalAlpha = 0.7;
  ctx.font = body(40, 700);
  ctx.fillText(`${d.profileName || 'Floww User'} · ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`, W / 2, 630);
  ctx.globalAlpha = 1;

  // hero number
  const total = d.totalFocusSeconds / 3600;
  ctx.font = display(220, 600);
  const grad = ctx.createLinearGradient(200, 0, 880, 0);
  grad.addColorStop(0, v('--primary'));
  grad.addColorStop(1, v('--secondary'));
  ctx.fillStyle = grad;
  ctx.fillText(`${total >= 100 ? Math.round(total) : total.toFixed(1)}h`, W / 2, 880);
  ctx.fillStyle = ink;
  ctx.font = body(44, 800);
  ctx.globalAlpha = 0.75;
  ctx.fillText('of deep focus, all time', W / 2, 950);
  ctx.globalAlpha = 1;

  // tiles
  const tiles = [
    ['🔥', `${s.streak}`, 'day streak'],
    ['🏆', `${d.bestStreak}`, 'best streak'],
    ['🎯', `${d.totalSessions}`, 'sessions'],
    ['📅', formatDuration(s.weekSeconds), 'this week'],
  ];
  const tw = 450, th = 200, gx = 60;
  tiles.forEach(([e, val, lab], i) => {
    const x = gx + (i % 2) * (tw + 60);
    const y = 1030 + Math.floor(i / 2) * (th + 40);
    ctx.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
    rr(ctx, x, y, tw, th, 48);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = body(64);
    ctx.fillText(e, x + 40, y + 120);
    ctx.fillStyle = ink;
    ctx.font = display(76);
    ctx.fillText(val, x + 140, y + 105);
    ctx.globalAlpha = 0.65;
    ctx.font = body(34);
    ctx.fillText(lab, x + 142, y + 152);
    ctx.globalAlpha = 1;
  });

  // last 7 days bars
  ctx.textAlign = 'center';
  const days = lastNDays(7);
  const vals = days.map((k) => d.dailyFocusSeconds?.[k] ?? 0);
  const max = Math.max(1, ...vals);
  const bx = 120, bw = 840, by = 1500, bh = 220;
  ctx.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  rr(ctx, bx - 60, by - 90, bw + 120, bh + 190, 48);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = body(34);
  ctx.globalAlpha = 0.7;
  ctx.fillText('Last 7 days', W / 2, by - 30);
  ctx.globalAlpha = 1;
  const slot = bw / 7;
  vals.forEach((val, i) => {
    const h = Math.max(val > 0 ? 10 : 4, (val / max) * bh);
    const x = bx + i * slot + slot * 0.2;
    ctx.fillStyle = i === 6 ? v('--primary') : `${v('--primary')}88`;
    rr(ctx, x, by + bh - h + 10, slot * 0.6, h, 14);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.6;
    ctx.font = body(28);
    ctx.fillText(keyToDate(days[i]).toLocaleDateString(undefined, { weekday: 'narrow' }), x + slot * 0.3, by + bh + 60);
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = ink;
  ctx.font = display(44, 600);
  ctx.fillText('youfloww.vercel.app', W / 2, 1860);

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
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
