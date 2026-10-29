/** The carriage: panelled wood walls, a brass-trimmed window with curtains, and a sill with a glass of chai. */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const ART = {
  frame: '/img/train/frame.webp',
  curtain: '/img/train/curtain.webp',
  chai: '/img/train/chai.webp',
};

/** Theme-aware colours for everything in the train (the mode has its own cozy palette, light or a night carriage). */
export function palette(dark: boolean) {
  return dark
    ? { ink: '#f5e9d8', soft: '#d9c6b0', paper: '#2c2131', paper2: '#3a2c3d', line: 'rgb(255 236 210 / 0.18)', wood1: '#3b2418', wood2: '#24150e', wood3: '#4b2e1d' }
    : { ink: '#3b2a20', soft: '#7a5a44', paper: '#fffaf1', paper2: '#fff1e0', line: 'rgb(91 63 44 / 0.35)', wood1: '#b9825a', wood2: '#8f5b3a', wood3: '#c99468' };
}
export type Pal = ReturnType<typeof palette>;

export const palVars = (p: Pal) =>
  ({
    '--tr-ink': p.ink,
    '--tr-soft': p.soft,
    '--tr-paper': p.paper,
    '--tr-paper2': p.paper2,
    '--tr-line': p.line,
  }) as CSSProperties;

export const PAPER = 'bg-[var(--tr-paper)] text-[var(--tr-ink)] border-2 border-[var(--tr-line)] shadow-[0_24px_60px_-28px_rgb(40_20_10/0.7)]';
export const BTN = 'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold disabled:opacity-40';
export const DARK_BTN = cn(BTN, 'h-12 bg-[var(--tr-ink)] px-6 text-[var(--tr-paper)] hover:opacity-90');
export const LIGHT_BTN = cn(BTN, 'h-11 border-2 border-[var(--tr-line)] bg-[var(--tr-paper)] px-4 text-[var(--tr-ink)] hover:bg-[var(--tr-paper2)]');
export const ROUND = 'pressable relative grid size-12 shrink-0 place-items-center rounded-full border-2 border-[var(--tr-line)] bg-[var(--tr-paper)] text-[var(--tr-ink)] shadow-[0_8px_20px_-10px_rgb(40_20_10/0.6)]';

/** Wood-panelled carriage wall with a warm lamp glow (stronger at night). */
export function Carriage({ pal, lamp, children }: { pal: Pal; lamp: number; children?: ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: [
          `radial-gradient(ellipse 70% 45% at 50% 0%, rgb(255 205 140 / ${0.18 + lamp * 0.3}), transparent 70%)`,
          `repeating-linear-gradient(90deg, rgb(0 0 0 / 0.07) 0 2px, transparent 2px 9px, rgb(255 255 255 / 0.035) 9px 10px, transparent 10px 150px)`,
          `linear-gradient(180deg, ${pal.wood3} 0%, ${pal.wood1} 38%, ${pal.wood2} 100%)`,
        ].join(','),
      }}
    >
      {children}
    </div>
  );
}

function Rivet({ className }: { className: string }) {
  return <span className={cn('absolute size-2.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff3c8,#c9a050_55%,#7a5a22)] shadow-[0_1px_2px_rgb(0_0_0/0.5)]', className)} />;
}

/** Hand-drawn curtain (SVG), gathered with a tasselled cord. Mirrored for the right side. */
function Curtain({ right }: { right?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 400"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute top-[-14px] h-[78%] w-[clamp(38px,8.5%,108px)] drop-shadow-[0_10px_14px_rgb(40_20_10/0.35)]', right ? '-right-[14px] -scale-x-100' : '-left-[14px]')}
      aria-hidden
    >
      <defs>
        <linearGradient id="tr-folds" x1="0" x2="1">
          <stop offset="0" stopColor="#a8504a" />
          <stop offset="0.18" stopColor="#d4776a" />
          <stop offset="0.32" stopColor="#b25a50" />
          <stop offset="0.5" stopColor="#de8a7a" />
          <stop offset="0.68" stopColor="#b85d52" />
          <stop offset="0.84" stopColor="#d77e70" />
          <stop offset="1" stopColor="#9c4842" />
        </linearGradient>
      </defs>
      <path d="M0 0H100C96 70 74 150 46 215C70 270 92 330 100 400C80 392 64 404 48 396C32 404 16 392 0 400Z" fill="url(#tr-folds)" stroke="#5b3a2c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d="M0 392C16 384 32 398 48 388C64 398 80 384 100 392" fill="none" stroke="#fff3df" strokeWidth="5" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M8 205C30 200 50 205 70 218" fill="none" stroke="#e7b75a" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx="70" cy="222" r="8" fill="#e7b75a" stroke="#8a6224" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d="M64 228l-4 30h20l-4-30z" fill="#f0c66a" stroke="#8a6224" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Scalloped pelmet across the top of the window. */
function Valance() {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[-10px] top-[-18px] h-[34px] w-[calc(100%+20px)] drop-shadow-[0_6px_8px_rgb(40_20_10/0.3)]" aria-hidden>
      <path
        d={`M0 0H400V22${Array.from({ length: 10 }, (_, i) => `Q${400 - i * 40 - 20} 42 ${400 - (i + 1) * 40} 22`).join('')}Z`}
        fill="#c4685d"
        stroke="#5b3a2c"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path d={`M0 18${Array.from({ length: 10 }, (_, i) => `Q${i * 40 + 20} 36 ${(i + 1) * 40} 18`).join('')}`} fill="none" stroke="#fff3df" strokeWidth="2" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The window: wooden frame + brass trim around whatever is outside (children), glass sheen on top. */
export function WindowFrame({ pal, className, children, overlay }: { pal: Pal; className?: string; children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      <div
        className="absolute inset-0 rounded-[34px] p-[12px] sm:rounded-[40px] sm:p-[16px]"
        style={{
          background: `linear-gradient(160deg, ${pal.wood3}, ${pal.wood1} 45%, ${pal.wood2})`,
          boxShadow: '0 30px 60px -30px rgb(30 15 5 / 0.8), inset 0 2px 0 rgb(255 255 255 / 0.25), inset 0 -3px 0 rgb(0 0 0 / 0.25)',
        }}
      >
        <div className="relative size-full overflow-hidden rounded-[22px] bg-[#c8d6c0] sm:rounded-[26px]">
          {children}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(115deg, rgb(255 255 255 / 0.18) 0%, transparent 24%, transparent 60%, rgb(255 255 255 / 0.09) 67%, transparent 74%)' }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_3px_#d4ab62,inset_0_0_0_5px_rgb(90_60_30/0.55),inset_0_10px_24px_rgb(0_0_0/0.35)]" />
          {overlay}
        </div>
        <Rivet className="top-[5px] left-[5px] sm:top-[7px] sm:left-[7px]" />
        <Rivet className="top-[5px] right-[5px] sm:top-[7px] sm:right-[7px]" />
        <Rivet className="bottom-[5px] left-[5px] sm:bottom-[7px] sm:left-[7px]" />
        <Rivet className="right-[5px] bottom-[5px] sm:right-[7px] sm:bottom-[7px]" />
      </div>
      <Valance />
      <Curtain />
      <Curtain right />
    </div>
  );
}

/** The window sill, with a glass of chai steaming on it. */
export function Sill({ pal, className, children }: { pal: Pal; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('relative z-[1] h-[20px] rounded-[10px] sm:h-[24px]', className)} style={{ background: `linear-gradient(180deg, ${pal.wood3}, ${pal.wood2})`, boxShadow: '0 14px 24px -12px rgb(20 10 5 / 0.8), inset 0 2px 0 rgb(255 255 255 / 0.3)' }}>
      <div className="pointer-events-none absolute right-[9%] bottom-[65%] h-[clamp(64px,11dvh,104px)]">
        <svg viewBox="0 0 60 90" className="absolute bottom-[78%] left-1/2 h-[70%] -translate-x-1/2 overflow-visible blur-[1.5px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${16 + i * 14} 88 q-7-11 0-22 t0-22 t0-22`} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="cafe-steam" style={{ animationDelay: `${i * 1.2}s` }} />
          ))}
        </svg>
        <img src="/img/cafe/chai.webp" alt="" decoding="async" draggable={false} className="relative h-full w-auto object-contain drop-shadow-[0_8px_8px_rgb(40_20_10/0.35)] select-none" />
      </div>
      {children}
    </div>
  );
}
