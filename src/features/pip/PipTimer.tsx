/**
 * The Floating buddy: a Document Picture-in-Picture window (Chrome / Edge 116+) with the cat, the timer,
 * play/pause and the current task. It stays on top of every other app, so you can study in a PDF reader,
 * Word or Notion and still see your buddy and your countdown.
 *
 * One shared window for the whole app: the dock / O key (via `usePip`) and the Study Desk
 * (`openBuddy` / `toggleBuddy`) all open the same one.
 *
 * Everything that animates in here runs on the PiP window's own timers and CSS: the main tab is usually
 * hidden while the buddy floats, and a hidden tab's timers and requestAnimationFrame are throttled or paused.
 */
import { createPortal } from 'react-dom';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { toast } from '@/store/ui';

/** The window's contents (cat, timer, styles) download only when someone opens it. */
const loadContent = () => import('./FloatingBuddy');
const FloatingBuddy = lazy(loadContent);

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
/** Open the floating buddy. Must run inside a click / key press. */
export async function openBuddy(): Promise<'open' | 'unsupported' | 'dismissed'> {
  const api = dpip();
  if (!api) return 'unsupported';
  if (pipWin) {
    pipWin.focus();
    return 'open';
  }
  if (opening) return 'open';
  opening = true;
  void loadContent(); // fetch the window's contents while the browser opens it
  try {
    const w = await api.requestWindow({ width: 320, height: 184 });
    copyStyles(w);
    w.document.title = 'YouFloww buddy';
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


export function PipPortal({ win }: { win: Window | null }) {
  if (!win) return null;
  return createPortal(
    <Suspense fallback={null}>
      <FloatingBuddy win={win} />
    </Suspense>,
    win.document.body,
  );
}
