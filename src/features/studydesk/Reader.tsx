/**
 * The reader around every kind of document: toolbar, page thumbnails, zoom / fit width, page jump,
 * day / sepia / night paper, keyboard, and a simple single column on phones.
 * Each viewer is its own lazy chunk, so pdf.js, docx-preview and pptx-preview download only when needed.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minus, Moon, PanelLeft, PictureInPicture2, Plus, ScrollText, Settings2, Sun, X } from 'lucide-react';
import { useFeatureData, updateFeatureData } from '@/lib/featureData';
import { isTypingTarget, cn } from '@/lib/utils';
import { useUI } from '@/store/ui';
import { usePrefs, THEMES } from '@/store/prefs';
import { forget, patchRecent, KIND_META, type DocKind, type Recent } from './recents';
import type { DocInfo, Paper, ThumbFn, ViewerProps } from './viewers/types';
import { cloneThumb } from './viewers/dom';
import { DeskBuddy } from './DeskBuddy';
import { DeskTimer } from './DeskTimer';
import { useBuddyWindow, pipSupported, toggleBuddy } from '../pip/PipTimer';
import { DESK_KEY, DESK_DEFAULT, type DeskPrefs } from './prefs';

const VIEWERS: Record<DocKind, ReturnType<typeof lazy<ComponentType<ViewerProps>>>> = {
  pdf: lazy(() => import('./viewers/PdfViewer')),
  docx: lazy(() => import('./viewers/DocxViewer')),
  pptx: lazy(() => import('./viewers/PptxViewer')),
  image: lazy(() => import('./viewers/ImageViewer')),
  text: lazy(() => import('./viewers/TextViewer')),
};

const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.85, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
type Zoom = 'auto' | 'fit' | number;

function useNarrow() {
  const q = '(max-width: 640px)';
  const [n, setN] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setN(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return n;
}

export function Reader({ file, kind, recent, onClose }: { file: File; kind: DocKind; recent: Recent | null; onClose: () => void }) {
  const narrow = useNarrow();
  const appTheme = usePrefs((s) => s.theme);
  const darkApp = !!THEMES.find((t) => t.id === appTheme)?.dark;
  // night paper by default in the dark themes, until you pick one yourself
  const prefs = useFeatureData<DeskPrefs>(DESK_KEY, darkApp ? { ...DESK_DEFAULT, paper: 'night' } : DESK_DEFAULT);
  const setPrefs = (p: Partial<DeskPrefs>) => updateFeatureData<DeskPrefs>(DESK_KEY, DESK_DEFAULT, (d) => Object.assign(d, p));
  const paper = prefs.paper;

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [info, setInfo] = useState<DocInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<Zoom>('auto');
  const [availW, setAvailW] = useState(800);
  const [menu, setMenu] = useState(false);
  const [jump, setJump] = useState<string | null>(null);
  const thumbRef = useRef<ThumbFn | null>(null);
  const reflow = kind === 'docx' && narrow;
  const pip = useBuddyWindow();
  const canPip = pipSupported();
  const sidebar = prefs.sidebar && !narrow && !!info && info.pages > 1;

  // the room the pages have (sidebar and window changes)
  useEffect(() => {
    if (!scroller) return;
    const ro = new ResizeObserver(() => setAvailW(scroller.clientWidth));
    ro.observe(scroller);
    setAvailW(scroller.clientWidth);
    return () => ro.disconnect();
  }, [scroller]);

  const fitScale = useMemo(() => {
    if (!info || info.fluid || !info.pageWidth) return 1;
    const pad = narrow ? 16 : 64;
    return Math.max(0.2, Math.min(3, (availW - pad) / info.pageWidth));
  }, [info, availW, narrow]);
  const scale = useMemo(() => {
    if (!info) return 1;
    if (typeof zoom === 'number') return zoom;
    if (info.fluid) return 1;
    if (kind === 'image') return Math.min(fitScale, 1);
    return zoom === 'fit' || narrow ? fitScale : Math.min(fitScale, kind === 'pptx' ? 1.1 : 1.25);
  }, [info, zoom, fitScale, narrow, kind]);

  /* ---------------- pages ---------------- */
  const pageEls = useCallback(() => (scroller ? [...scroller.querySelectorAll<HTMLElement>('[data-sd-page]')] : []), [scroller]);

  const target = useRef<{ page: number; until: number } | null>(null);
  const goTo = useCallback(
    (n: number, smooth = true) => {
      if (!scroller || !info) return;
      const p = Math.max(1, Math.min(info.pages, Math.round(n)));
      const el = scroller.querySelector<HTMLElement>(`[data-sd-page="${p}"]`);
      if (!el) return;
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (narrow ? 8 : 16);
      const glide = smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      // while the scroll glides there, quick key presses count from the target page
      target.current = glide ? { page: p, until: Date.now() + 900 } : null;
      scroller.scrollTo({ top, behavior: glide ? 'smooth' : 'auto' });
      setPage(p);
    },
    [scroller, info, narrow],
  );

  // which page you're on: the one crossing a line 35% down the screen
  useEffect(() => {
    if (!scroller || !info) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      if (target.current && Date.now() < target.current.until) return;
      target.current = null;
      const els = pageEls();
      if (!els.length) return;
      const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.35;
      let lo = 0;
      let hi = els.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (els[mid].getBoundingClientRect().bottom < line) lo = mid + 1;
        else hi = mid;
      }
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      setPage(atEnd && scroller.scrollTop > 0 ? els.length : lo + 1);
    };
    const onScroll = () => (raf ||= requestAnimationFrame(measure));
    const onEnd = () => {
      target.current = null;
      onScroll();
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', onEnd);
    measure();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('scrollend', onEnd);
      cancelAnimationFrame(raf);
    };
  }, [scroller, info, pageEls]);

  // open where you left off
  const restored = useRef(false);
  useEffect(() => {
    if (!info || restored.current) return;
    restored.current = true;
    const start = recent?.page ?? 1;
    if (start > 1) requestAnimationFrame(() => goTo(start, false));
    if (recent) void patchRecent(recent.id, { pages: info.pages });
  }, [info, recent, goTo]);

  // remember the page (gently)
  useEffect(() => {
    if (!recent || !info) return;
    const t = setTimeout(() => void patchRecent(recent.id, { page }), 700);
    return () => clearTimeout(t);
  }, [page, recent, info]);

  // keep the same spot on the page while zooming
  const anchor = useRef<{ page: number; frac: number } | null>(null);
  const prevScale = useRef(scale);
  if (prevScale.current !== scale && scroller && !anchor.current) {
    const el = scroller.querySelector<HTMLElement>(`[data-sd-page="${page}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const top = scroller.getBoundingClientRect().top;
      anchor.current = { page, frac: r.height ? (top + 16 - r.top) / r.height : 0 };
    }
  }
  useLayoutEffect(() => {
    if (prevScale.current === scale) return;
    prevScale.current = scale;
    const a = anchor.current;
    anchor.current = null;
    if (!a || !scroller) return;
    const el = scroller.querySelector<HTMLElement>(`[data-sd-page="${a.page}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    scroller.scrollTop += r.top + a.frac * r.height - (scroller.getBoundingClientRect().top + 16);
  }, [scale, scroller]);

  const zoomBy = useCallback(
    (dir: 1 | -1) => {
      const cur = scale;
      const next = dir > 0 ? STEPS.find((s) => s > cur + 0.01) ?? STEPS.at(-1)! : [...STEPS].reverse().find((s) => s < cur - 0.01) ?? STEPS[0];
      setZoom(info?.fluid ? Math.max(0.67, Math.min(2, next)) : next);
    },
    [scale, info],
  );

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const ui = useUI.getState();
      if (ui.palette || ui.confirm || ui.completion) return;
      if (e.key === 'Escape') {
        // one step back at a time: menu, then the desk, then (the app's own handler) out of the mode
        e.stopPropagation();
        if (menu) setMenu(false);
        else onClose();
        return;
      }
      const k = e.key;
      let used = true;
      const from = target.current?.page ?? page;
      if (k === 'ArrowRight' || k === 'PageDown') goTo(from + 1);
      else if (k === 'ArrowLeft' || k === 'PageUp') goTo(from - 1);
      else if (k === 'ArrowDown') scroller?.scrollBy({ top: scroller.clientHeight * 0.18, behavior: 'smooth' });
      else if (k === 'ArrowUp') scroller?.scrollBy({ top: -scroller.clientHeight * 0.18, behavior: 'smooth' });
      else if (k === 'Home') goTo(1);
      else if (k === 'End') goTo(info?.pages ?? 1);
      else if (k === '+' || k === '=') zoomBy(1);
      else if (k === '-' || k === '_') zoomBy(-1);
      else if (k === '0') setZoom('fit');
      else if (k.toLowerCase() === 'o') void toggleBuddy();
      else used = false;
      if (used) e.preventDefault();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [goTo, page, scroller, info, zoomBy, menu, onClose]);

  // ctrl/⌘ + wheel or a trackpad pinch zooms the document, not the whole app
  useEffect(() => {
    if (!scroller) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      zoomBy(acc < 0 ? 1 : -1);
      acc = 0;
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [scroller, zoomBy]);

  const fail = useCallback(
    (msg: string) => {
      setError(msg);
      if (recent) void forget(recent.id); // don't keep a file that can't be opened on the desk
    },
    [recent],
  );

  const Viewer = VIEWERS[kind];
  const pct = Math.round(scale * 100);
  const pages = info?.pages ?? 0;
  const paged = pages > 1;
  const meta = KIND_META[kind];

  const paperBtns = (
    <div className="flex items-center gap-0.5 rounded-2xl bg-line p-0.5" role="radiogroup" aria-label="Reading light">
      {(
        [
          ['day', <Sun key="d" size={16} />, 'Day'],
          ['sepia', <ScrollText key="s" size={16} />, 'Sepia'],
          ['night', <Moon key="n" size={16} />, 'Night'],
        ] as const
      ).map(([id, icon, label]) => (
        <button
          key={id}
          role="radio"
          aria-checked={paper === id}
          title={`${label} reading`}
          onClick={() => setPrefs({ paper: id as Paper })}
          className={cn('pressable grid h-8 min-w-8 place-items-center rounded-[14px] px-2 text-xs font-extrabold', paper === id ? 'bg-surface-strong text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {narrow ? (
            <span className="flex items-center gap-1.5">
              {icon}
              {label}
            </span>
          ) : (
            icon
          )}
        </button>
      ))}
    </div>
  );

  const zoomCtl = (
    <div className="flex items-center gap-0.5 rounded-2xl bg-line p-0.5">
      <button onClick={() => zoomBy(-1)} aria-label="Zoom out" title="Zoom out (−)" className="pressable grid size-8 place-items-center rounded-[14px] text-ink hover:bg-surface-strong">
        <Minus size={16} />
      </button>
      <button onClick={() => setZoom(info?.fluid ? 1 : 'fit')} title="Fit width (0)" className={cn('pressable tabular h-8 min-w-[54px] rounded-[14px] px-1.5 text-xs font-black', zoom === 'fit' ? 'bg-surface-strong' : 'hover:bg-surface-strong')}>
        {pct}%
      </button>
      <button onClick={() => zoomBy(1)} aria-label="Zoom in" title="Zoom in (+)" className="pressable grid size-8 place-items-center rounded-[14px] text-ink hover:bg-surface-strong">
        <Plus size={16} />
      </button>
    </div>
  );

  const popBtn = canPip && (
    <button
      onClick={() => void toggleBuddy()}
      title={pip ? 'Bring your buddy back (O)' : 'Pop out buddy: float your cat and timer over any app (O)'}
      className={cn('pressable flex h-9 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-extrabold', pip ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-ink hover:brightness-105')}
    >
      <PictureInPicture2 size={16} /> {narrow ? (pip ? 'Floating' : 'Pop out') : pip ? 'Buddy is floating' : 'Pop out buddy'}
    </button>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* top bar */}
      <header className="glass-strong relative z-30 m-2 flex h-14 shrink-0 items-center gap-2 rounded-[22px] px-2 sm:m-3 sm:px-3">
        <button onClick={onClose} className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-2xl px-2.5 text-[13px] font-extrabold hover:bg-line" title="Back to your desk (Esc)">
          <ArrowLeft size={17} /> <span className="hidden sm:inline">Desk</span>
        </button>
        {!narrow && paged && (
          <button onClick={() => setPrefs({ sidebar: !prefs.sidebar })} aria-pressed={sidebar} aria-label="Page thumbnails" title="Page thumbnails" className={cn('pressable grid size-9 shrink-0 place-items-center rounded-2xl', sidebar ? 'bg-accent-soft' : 'hover:bg-line')}>
            <PanelLeft size={17} />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl text-base" style={{ background: `color-mix(in oklab, ${meta.tint} 18%, transparent)` }} aria-hidden>
            {meta.emoji}
          </span>
          <span className="truncate font-display text-[15px] font-semibold sm:text-base" title={file.name}>
            {file.name}
          </span>
        </div>
        {!narrow && (
          <div className="flex shrink-0 items-center gap-2">
            {zoomCtl}
            {!info?.fluid && kind !== 'image' && (
              <button onClick={() => setZoom('fit')} title="Fit width (0)" aria-label="Fit width" className={cn('pressable grid size-9 place-items-center rounded-2xl', zoom === 'fit' ? 'bg-accent-soft' : 'hover:bg-line')}>
                <Maximize2 size={16} />
              </button>
            )}
            {paperBtns}
            {popBtn}
          </div>
        )}
        {narrow && (
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Reading options" className={cn('pressable grid size-9 shrink-0 place-items-center rounded-2xl', menu ? 'bg-accent-soft' : 'hover:bg-line')}>
            <Settings2 size={18} />
          </button>
        )}
        <button onClick={() => useUI.getState().set({ mode: null })} aria-label="Leave the Study Desk" title="Leave the Study Desk" className="pressable grid size-9 shrink-0 place-items-center rounded-2xl hover:bg-line">
          <X size={18} />
        </button>

        <AnimatePresence>
          {narrow && menu && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              className="glass-strong absolute top-[calc(100%+8px)] right-0 left-0 z-40 flex flex-col gap-3 rounded-[22px] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black tracking-wider text-muted uppercase">{kind === 'docx' || kind === 'text' ? 'Text size' : 'Zoom'}</span>
                {zoomCtl}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black tracking-wider text-muted uppercase">Light</span>
                {paperBtns}
              </div>
              {popBtn && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black tracking-wider text-muted uppercase">Float on top</span>
                  {popBtn}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black tracking-wider text-muted uppercase">Buddy</span>
                <button onClick={() => setPrefs({ buddy: !prefs.buddy })} className="pressable h-9 rounded-2xl bg-line px-3 text-[13px] font-extrabold">
                  {prefs.buddy ? 'Hide the cat' : 'Show the cat'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* thumbnails */}
        <AnimatePresence initial={false}>
          {sidebar && info && scroller && (
            <motion.aside
              key="thumbs"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 172, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="relative shrink-0 overflow-hidden"
              aria-label="Pages"
            >
              <Thumbs info={info} current={page} onPick={goTo} thumbRef={thumbRef} scroller={scroller} paper={paper} kind={kind} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* the document */}
        <div
          ref={setScroller}
          tabIndex={-1}
          className={cn('sd-scroll relative min-w-0 flex-1 overflow-auto overscroll-contain outline-none', `sd-paper-${paper}`, narrow ? 'pb-28' : 'pb-24', reflow && 'sd-narrow')}
          aria-label={file.name}
        >
          {scroller && !error && (
            <Suspense fallback={null}>
              <Viewer file={file} scale={scale} scroller={scroller} reflow={reflow} onInfo={setInfo} onError={fail} onCover={recent && !recent.thumb ? (b) => void patchRecent(recent.id, { thumb: b }) : undefined} thumbRef={thumbRef} />
            </Suspense>
          )}
        </div>

        {/* loading / error */}
        <AnimatePresence>
          {!info && !error && (
            <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.15 }} className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="glass flex flex-col items-center gap-2 rounded-3xl px-6 py-5 text-center">
                <motion.span className="text-4xl" animate={{ y: [0, -8, 0], rotate: [0, -5, 5, 0] }} transition={{ duration: 1.1, repeat: Infinity }}>
                  {meta.emoji}
                </motion.span>
                <span className="font-display text-lg font-semibold">Opening your {meta.label.toLowerCase()}…</span>
                <span className="max-w-[240px] truncate text-xs font-bold text-muted">{file.name}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="glass-strong flex max-w-[380px] flex-col items-center gap-3 rounded-[28px] p-6 text-center">
              <span className="text-5xl">🙀</span>
              <p className="font-display text-xl font-semibold">Couldn’t open this one</p>
              <p className="text-sm font-bold text-muted">{error}</p>
              <button onClick={onClose} className="pressable h-11 rounded-2xl bg-accent px-5 font-extrabold text-accent-ink">
                Back to my desk
              </button>
            </div>
          </div>
        )}

        {/* page pill */}
        {info && paged && (
          <div className={cn('pointer-events-none absolute inset-x-0 z-20 flex justify-center', narrow ? 'bottom-[max(12px,env(safe-area-inset-bottom))]' : 'bottom-4')}>
            <div className="glass-strong pointer-events-auto flex h-11 items-center gap-1 rounded-full px-1.5">
              <button onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page" className="pressable grid size-8 place-items-center rounded-full hover:bg-line disabled:opacity-30">
                <ChevronLeft size={18} />
              </button>
              {jump !== null ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(jump);
                    if (n) goTo(n);
                    setJump(null);
                  }}
                  className="flex items-center gap-1 text-sm font-extrabold"
                >
                  <input
                    autoFocus
                    inputMode="numeric"
                    aria-label="Go to page"
                    value={jump}
                    onChange={(e) => setJump(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    onBlur={() => setJump(null)}
                    onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setJump(null))}
                    className="tabular h-8 w-12 rounded-xl bg-line text-center outline-none"
                  />
                  <span className="text-muted">/ {pages}</span>
                </form>
              ) : (
                <button onClick={() => setJump(String(page))} title="Go to page" className="pressable tabular h-8 rounded-full px-2.5 text-sm font-extrabold hover:bg-line">
                  {page} <span className="text-muted">/ {pages}</span>
                </button>
              )}
              <button onClick={() => goTo(page + 1)} disabled={page >= pages} aria-label="Next page" className="pressable grid size-8 place-items-center rounded-full hover:bg-line disabled:opacity-30">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* timer + buddy */}
        <DeskTimer className={narrow ? 'absolute left-3 z-20 bottom-[calc(max(12px,env(safe-area-inset-bottom))+52px)]' : cn('absolute bottom-4 z-20 transition-[left] duration-300', sidebar ? 'left-[188px]' : 'left-4')} compact={narrow} />
        {prefs.buddy && scroller && info && <DeskBuddy scroller={scroller} page={page} pages={pages} ground={narrow ? 64 : 10} floating={!!pip} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page thumbnails (drawn only while they're in view)                   */
/* ------------------------------------------------------------------ */
function Thumbs({ info, current, onPick, thumbRef, scroller, paper, kind }: { info: DocInfo; current: number; onPick: (n: number) => void; thumbRef: { current: ThumbFn | null }; scroller: HTMLElement; paper: Paper; kind: DocKind }) {
  const box = useRef<HTMLDivElement>(null);
  const W = 120;
  const ratio = info.pageWidth ? info.pageHeight / info.pageWidth : 1.29;

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const live = new Map<Element, () => void>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const host = e.target.querySelector<HTMLElement>('.sd-thumb-art');
          if (!host) continue;
          if (e.isIntersecting && !live.has(e.target)) {
            const n = Number((e.target as HTMLElement).dataset.n);
            const done = (thumbRef.current ?? ((p, h, w) => cloneThumb(scroller, p, h, w)))(n, host, W);
            live.set(e.target, done ?? (() => host.replaceChildren()));
          } else if (!e.isIntersecting && live.has(e.target)) {
            live.get(e.target)!();
            live.delete(e.target);
            host.replaceChildren();
          }
        }
      },
      { root, rootMargin: '300px 0px' },
    );
    // give DOM viewers a moment to lay out their pages before cloning them
    const t = setTimeout(() => root.querySelectorAll('[data-n]').forEach((el) => io.observe(el)), kind === 'pdf' ? 0 : 250);
    return () => {
      clearTimeout(t);
      io.disconnect();
      live.forEach((f) => f());
    };
  }, [info.pages, thumbRef, scroller, kind]);

  // keep the current page's thumbnail in view
  useEffect(() => {
    box.current?.querySelector(`[data-n="${current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return (
    <div ref={box} className={cn('no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain px-3 pt-1 pb-24', `sd-paper-${paper}`, 'sd-thumbs')}>
      {Array.from({ length: info.pages }, (_, i) => (
        <button key={i} data-n={i + 1} onClick={() => onPick(i + 1)} aria-label={`Page ${i + 1}`} aria-current={current === i + 1 ? 'page' : undefined} className="group mb-3 flex w-full flex-col items-center gap-1">
          <span className={cn('sd-thumb relative block overflow-hidden rounded-lg transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5', current === i + 1 && 'sd-thumb-on', (kind === 'pptx' || kind === 'image') && 'sd-thumb-slide')} style={{ width: W, minHeight: Math.round(W * ratio) }}>
            <span className="sd-thumb-art block" />
          </span>
          <span className={cn('tabular text-[11px] font-black', current === i + 1 ? 'text-accent' : 'text-muted')}>{i + 1}</span>
        </button>
      ))}
    </div>
  );
}
