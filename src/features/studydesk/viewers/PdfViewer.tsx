/**
 * PDF pages, drawn lazily with pdf.js: only pages near the screen get a canvas (canvases are recycled),
 * sharp on retina (devicePixelRatio) without blowing up memory, with a selectable text layer.
 * Closing the file destroys the document and its worker.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { coverFrom } from '../cover';
import { errMsg, type ViewerProps } from './types';

type PdfLib = typeof import('pdfjs-dist');
let lib: Promise<PdfLib> | null = null;
function loadPdfjs() {
  return (lib ??= (async () => {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })());
}

/**
 * Optional pdf.js data (CJK cmaps, the 14 standard fonts, JPEG2000/JBIG2 decoders). Used only when the
 * lead copies them to /studydesk/pdfjs/ (see INTEGRATION.md); without them pdf.js falls back on its own.
 */
const ASSETS = '/studydesk/pdfjs/';
let assets: Promise<{ cMapUrl?: string; standardFontDataUrl?: string; wasmUrl?: string }> | null = null;
const pdfAssets = () =>
  (assets ??= fetch(`${ASSETS}cmaps/78-H.bcmap`, { method: 'HEAD' })
    .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('html') ? { cMapUrl: `${ASSETS}cmaps/`, standardFontDataUrl: `${ASSETS}standard_fonts/`, wasmUrl: `${ASSETS}wasm/` } : {}))
    .catch(() => ({})) as Promise<{ cMapUrl?: string; standardFontDataUrl?: string; wasmUrl?: string }>);

/** 100% = the page's real printed size (pdf points -> CSS px) */
const PT = 96 / 72;
/** cap a page canvas at ~16 MP so zooming a poster can't exhaust GPU memory */
const MAX_PIXELS = 16_000_000;

/* recycled canvases */
const pool: HTMLCanvasElement[] = [];
const takeCanvas = () => pool.pop() ?? document.createElement('canvas');
function giveCanvas(c: HTMLCanvasElement) {
  c.remove();
  if (pool.length < 6) pool.push(c);
  else {
    c.width = 0;
    c.height = 0;
  }
}

interface Size {
  w: number;
  h: number;
}

export default function PdfViewer({ file, scale, scroller, onInfo, onError, onCover, thumbRef }: ViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [near, setNear] = useState<Set<number>>(() => new Set());
  const [hiScale, setHiScale] = useState(scale);
  const cbs = useRef({ onInfo, onError, onCover });
  cbs.current = { onInfo, onError, onCover };

  // open the file
  useEffect(() => {
    let dead = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      const [pdfjs, extra, data] = await Promise.all([loadPdfjs(), pdfAssets(), file.arrayBuffer()]);
      if (dead) return;
      task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, enableXfa: false, ...extra } as Parameters<PdfLib['getDocument']>[0]);
      task.onPassword = (update: (pw: string) => void, reason: number) => {
        const pw = window.prompt(reason === 2 ? 'That password didn’t work. Try again:' : `“${file.name}” is locked. Password:`);
        if (pw === null) {
          void task?.destroy();
          cbs.current.onError('This PDF is password-protected.');
        } else update(pw);
      };
      const pdf = await task.promise;
      if (dead) return;
      const first = await pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      const base = { w: vp.width * PT, h: vp.height * PT };
      setSizes(Array.from({ length: pdf.numPages }, () => base));
      setDoc(pdf);
      cbs.current.onInfo({ pages: pdf.numPages, pageWidth: base.w, pageHeight: base.h });
      // a cover for the shelf
      if (cbs.current.onCover) {
        const c = document.createElement('canvas');
        const s = 240 / vp.width;
        const v2 = first.getViewport({ scale: s });
        c.width = Math.round(v2.width);
        c.height = Math.round(v2.height);
        await first.render({ canvas: c, viewport: v2 }).promise.catch(() => {});
        if (!dead) {
          const b = await coverFrom(c, c.width, c.height);
          if (b) cbs.current.onCover?.(b);
        }
        c.width = 0;
      }
    })().catch((e) => {
      if (!dead && !/destroyed|cancel/i.test(errMsg(e))) cbs.current.onError(/Invalid PDF/i.test(errMsg(e)) ? 'This file doesn’t look like a valid PDF.' : errMsg(e));
    });
    return () => {
      dead = true;
      void task?.destroy(); // also ends the worker
      setDoc(null);
    };
  }, [file]);

  // a page's real size, learned when it is first drawn (most PDFs have one size for every page)
  const learn = (i: number, s: Size) =>
    setSizes((prev) => {
      const o = prev[i];
      if (!o || (Math.abs(o.w - s.w) < 0.5 && Math.abs(o.h - s.h) < 0.5)) return prev;
      const next = prev.slice();
      next[i] = s;
      return next;
    });

  // which pages are on (or near) the screen
  useEffect(() => {
    if (!doc) return;
    const io = new IntersectionObserver(
      (entries) =>
        setNear((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.sdPage) - 1;
            if (e.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        }),
      { root: scroller, rootMargin: '120% 0px 120% 0px' },
    );
    for (const el of scroller.querySelectorAll('[data-sd-page]')) io.observe(el);
    return () => io.disconnect();
  }, [doc, scroller, sizes.length]);

  // redraw sharply a moment after zooming stops (pages stretch smoothly meanwhile)
  useEffect(() => {
    const t = setTimeout(() => setHiScale(scale), 140);
    return () => clearTimeout(t);
  }, [scale]);

  // thumbnails for the sidebar
  useEffect(() => {
    if (!doc) return;
    thumbRef.current = (n, host, width) => {
      let task: RenderTask | null = null;
      let dead = false;
      const c = document.createElement('canvas');
      c.style.width = '100%';
      c.style.display = 'block';
      void doc
        .getPage(n)
        .then((page) => {
          if (dead) return;
          const v1 = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / v1.width) * Math.min(2, devicePixelRatio || 1) });
          c.width = Math.round(vp.width);
          c.height = Math.round(vp.height);
          host.append(c);
          task = page.render({ canvas: c, viewport: vp });
          return task.promise;
        })
        .catch(() => {});
      return () => {
        dead = true;
        task?.cancel();
        c.width = 0;
        c.remove();
      };
    };
    return () => {
      thumbRef.current = null;
    };
  }, [doc, thumbRef]);

  if (!doc) return <PdfLoading />;
  return (
    <div className="sd-pages">
      {sizes.map((s, i) => (
        <PdfPage key={i} doc={doc} index={i} size={s} scale={scale} hiScale={hiScale} near={near.has(i)} learn={learn} />
      ))}
    </div>
  );
}

function PdfLoading() {
  return (
    <div className="sd-pages">
      <div className="sd-page sd-skeleton" style={{ width: 'min(816px, 92%)', aspectRatio: '0.773' }} />
    </div>
  );
}

const PdfPage = memo(function PdfPage({ doc, index, size, scale, hiScale, near, learn }: { doc: PDFDocumentProxy; index: number; size: Size; scale: number; hiScale: number; near: boolean; learn: (i: number, s: Size) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  // fetch the page only when it comes near; let pdf.js free it when it leaves
  useEffect(() => {
    if (!near) return;
    let dead = false;
    let p: PDFPageProxy | null = null;
    void doc
      .getPage(index + 1)
      .then((pg) => {
        if (dead) return;
        p = pg;
        const vp = pg.getViewport({ scale: 1 });
        learn(index, { w: vp.width * PT, h: vp.height * PT });
        setPage(pg);
      })
      .catch(() => {});
    return () => {
      dead = true;
      setPage(null);
      p?.cleanup();
    };
  }, [doc, index, near, learn]);

  // draw into a recycled canvas, then swap it in (no white flash while zooming)
  useEffect(() => {
    const host = box.current;
    if (!page || !host) return;
    let task: RenderTask | null = null;
    let dead = false;
    const c = takeCanvas();
    const cssW = size.w * hiScale;
    const cssH = size.h * hiScale;
    const out = Math.max(0.5, Math.min(devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / Math.max(1, cssW * cssH))));
    const vp = page.getViewport({ scale: hiScale * PT * out });
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    c.className = 'sd-canvas';
    task = page.render({ canvas: c, viewport: vp });
    task.promise
      .then(() => {
        if (dead) return;
        host.querySelectorAll('canvas.sd-canvas').forEach((old) => old !== c && giveCanvas(old as HTMLCanvasElement));
        host.prepend(c);
      })
      .catch(() => {
        if (!dead) giveCanvas(c);
      });
    return () => {
      dead = true;
      task?.cancel();
      if (!c.isConnected) giveCanvas(c);
    };
  }, [page, hiScale, size.w, size.h]);

  // release the canvas when the page leaves
  useEffect(() => {
    if (near) return;
    box.current?.querySelectorAll('canvas.sd-canvas').forEach((c) => giveCanvas(c as HTMLCanvasElement));
  }, [near]);

  // selectable text (sized by CSS variables, so zooming doesn't rebuild it)
  useEffect(() => {
    const host = text.current;
    if (!page || !host) return;
    let dead = false;
    let layer: { cancel: () => void } | null = null;
    void loadPdfjs().then(({ TextLayer }) => {
      if (dead) return;
      const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: host, viewport: page.getViewport({ scale: 1 }) });
      layer = tl;
      return tl.render();
    }).catch(() => {});
    return () => {
      dead = true;
      layer?.cancel();
      host.replaceChildren();
    };
  }, [page]);

  const style = useMemo(
    () => ({ width: Math.round(size.w * scale), height: Math.round(size.h * scale), ['--total-scale-factor' as string]: String(scale * PT) }),
    [size.w, size.h, scale],
  );

  return (
    <div ref={box} data-sd-page={index + 1} className="sd-page sd-pdf-page" style={style}>
      <div ref={text} className="textLayer" />
      {!page && <span className="sd-page-no">{index + 1}</span>}
    </div>
  );
});
