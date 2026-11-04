/**
 * The Floating buddy: a Document Picture-in-Picture window (Chrome / Edge 116+) with the cat, the timer,
 * play/pause and the current task. It stays on top of every other app, so you can study in a PDF reader,
 * Word or Notion and still see your buddy and your countdown.
 *
 * One shared window for the whole app: the button beside the timer controls, the dock / O key (via `usePip`)
 * and the Study Desk (`openBuddy` / `toggleBuddy`) all open the same one.
 *
 * Two layouts share the window: the buddy card, and the wide, thin progress strip (ProgressStrip.tsx: the cat
 * running along a track, or the steam train on a train ride). The tab's favicon and title show progress too
 * (tabIcon.ts).
 *
 * Everything that animates in here runs on the PiP window's own timers and CSS: the main tab is usually
 * hidden while the buddy floats, and a hidden tab's timers and requestAnimationFrame are throttled or paused.
 */
import { createPortal } from 'react-dom';
import { Component, lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { toast } from '@/store/ui';
import { usePrefs } from '@/store/prefs';

/** The window's contents (cat, timer, styles) download only when someone opens it. */
const loadContent = () => import('./FloatingBuddy');
const FloatingBuddy = lazy(loadContent);
const loadStrip = () => import('./ProgressStrip');
const ProgressStrip = lazy(loadStrip);

export type PipLayout = 'buddy' | 'strip';
/** inner size of a layout, CSS px. The strip asks for the screen's width; Chrome caps it (at about 80%). */
const sizeOf = (l: PipLayout) =>
  l === 'strip' ? { width: Math.max(640, Math.round((screen.availWidth || 800) * 0.8)), height: 120 } : { width: 320, height: 184 };

type DPiP = {
  requestWindow: (o: { width: number; height: number; disallowReturnToOpener?: boolean; preferInitialWindowPlacement?: boolean }) => Promise<Window>;
  window?: Window | null;
};
const dpip = () => (typeof window === 'undefined' ? undefined : (window as Window & { documentPictureInPicture?: DPiP }).documentPictureInPicture);

export const pipSupported = () => !!dpip();

/* ------------------------------------------------------------------ */
/* One shared window                                                    */
/* ------------------------------------------------------------------ */
let pipWin: Window | null = null;
let layout: PipLayout = 'buddy';
const subs = new Set<() => void>();
const setWin = (w: Window | null) => {
  pipWin = w;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** The floating buddy window, or null (re-renders when it opens or closes). */
export const useBuddyWindow = () => useSyncExternalStore(subscribe, () => pipWin, () => null);
export const isBuddyOpen = () => !!pipWin;
/** Which layout the window shows (re-renders when it changes). */
export const useBuddyLayout = () => useSyncExternalStore(subscribe, () => layout, () => 'buddy' as PipLayout);

/** Switch the open window between the buddy card and the progress strip (from a click inside it). */
export function setLayout(next: PipLayout) {
  if (next === layout) return;
  layout = next;
  usePrefs.getState().set({ pipLayout: next });
  const w = pipWin;
  if (w) {
    w.document.title = next === 'strip' ? 'YouFloww progress' : 'YouFloww buddy';
    try {
      // resizeTo takes the outer size; keep the window's own frame on top of the layout's size
      const size = sizeOf(next);
      w.resizeTo(size.width + (w.outerWidth - w.innerWidth), size.height + (w.outerHeight - w.innerHeight));
    } catch {
      /* the browser said no: the layout still fits whatever size the window has */
    }
  }
  subs.forEach((f) => f());
}

/** Bring the app's fonts and styles into the PiP document (it starts out as a blank page). */
function copyStyles(w: Window) {
  const d = w.document;
  // relative urls (fonts, the cat strips) resolve against the app, not about:blank
  const base = d.createElement('base');
  base.href = document.baseURI;
  d.head.append(base);
  const meta = d.createElement('meta');
  meta.name = 'color-scheme';
  meta.content = 'light dark';
  d.head.append(meta);
  for (const node of document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')) {
    if (node instanceof HTMLLinkElement) {
      const link = d.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href; // already absolute
      d.head.append(link);
      continue;
    }
    const style = d.createElement('style');
    try {
      // cssRules also carries rules added with insertRule()
      const rules = node.sheet?.cssRules;
      style.textContent = rules ? [...rules].map((r) => r.cssText).join('\n') : node.textContent;
    } catch {
      style.textContent = node.textContent;
    }
    d.head.append(style);
  }
}

/** Keep the PiP page on the same theme / mode colours as the app (incl. auto-dark). */
function mirrorTheme(w: Window) {
  const src = document.documentElement;
  const dst = w.document.documentElement;
  const sync = () => {
    for (const a of ['data-theme', 'data-mode']) {
      const v = src.getAttribute(a);
      if (v === null) dst.removeAttribute(a);
      else dst.setAttribute(a, v);
    }
  };
  sync();
  const mo = new MutationObserver(sync);
  mo.observe(src, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
  return () => mo.disconnect();
}

let opening = false;
/** Open the floating window (in `want`, else its last layout). Must run inside a click / key press. */
export async function openBuddy(want?: PipLayout): Promise<'open' | 'unsupported' | 'dismissed'> {
  const api = dpip();
  if (!api) return 'unsupported';
  if (pipWin) {
    if (want) setLayout(want);
    pipWin.focus();
    return 'open';
  }
  if (opening) return 'open';
  opening = true;
  const l = want ?? usePrefs.getState().pipLayout ?? 'buddy';
  void (l === 'strip' ? loadStrip() : loadContent()); // fetch the window's contents while the browser opens it
  try {
    // Chrome otherwise reopens at the last window's size, which may belong to the other layout (a 240px-wide strip)
    const w = await api.requestWindow({ ...sizeOf(l), preferInitialWindowPlacement: true });
    layout = l;
    copyStyles(w);
    w.document.title = l === 'strip' ? 'YouFloww progress' : 'YouFloww buddy';
    w.document.documentElement.lang = 'en';
    const stop = mirrorTheme(w);
    w.addEventListener('pagehide', () => {
      stop();
      if (pipWin === w) setWin(null);
    });
    setWin(w);
    return 'open';
  } catch {
    return 'dismissed';
  } finally {
    opening = false;
  }
}

export function closeBuddy() {
  pipWin?.close();
  setWin(null);
}

const UNSUPPORTED = { emoji: '🪟', title: 'Floating buddy needs Chrome or Edge', body: 'On a computer with Chrome or Edge 116+, your buddy can float on top of any app.' };

/** Open, or close when it is already open. Shows a friendly note on browsers without Document PiP. */
export async function toggleBuddy() {
  if (pipWin) return closeBuddy();
  if ((await openBuddy()) === 'unsupported') toast(UNSUPPORTED);
}

/** The app shell's pop-out (dock button, O key, command menu). */
export function usePip() {
  const win = useBuddyWindow();
  return { win, open: toggleBuddy, supported: pipSupported() };
}

/**
 * A failure inside the window stays in the window instead of blanking the whole app. The usual one: an open tab
 * still runs an older version, and after an update that version's files for the other layout are gone.
 */
class PipBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    // inline styles: the window's stylesheet may be part of what failed
    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 12,
          font: '700 13px/1.3 system-ui, sans-serif',
          color: 'var(--ink, #2a2340)',
          background: 'var(--bg, #fff6ee)',
          textAlign: 'center',
        }}
      >
        <span>YouFloww needs a quick reload</span>
        <button
          onClick={() => location.reload()}
          style={{ font: 'inherit', border: 0, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', color: 'var(--accent-ink, #fff)', background: 'var(--accent, #8b6cf0)' }}
        >
          Reload
        </button>
      </div>
    );
  }
}

export function PipPortal({ win }: { win: Window | null }) {
  const l = useBuddyLayout();
  if (!win) return null;
  return createPortal(
    // keyed on the layout, so switching layouts tries again
    <PipBoundary key={l}>
      <Suspense fallback={null}>
        {l === 'strip' ? <ProgressStrip win={win} onBuddy={() => setLayout('buddy')} /> : <FloatingBuddy win={win} onStrip={() => setLayout('strip')} />}
      </Suspense>
    </PipBoundary>,
    win.document.body,
  );
}
