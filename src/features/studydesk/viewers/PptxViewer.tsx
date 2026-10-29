/**
 * PowerPoint (.pptx) with pptx-preview. If a deck can't be drawn, a clean fallback shows every slide's
 * text and pictures (read straight from the file with JSZip), so you can still study from it.
 */
import { useEffect, useRef, useState } from 'react';
import type JSZipType from 'jszip';
import { coverFromText, officeThumbnail } from '../cover';
import { errMsg, type ViewerProps } from './types';
import { revokeBlobUrls } from './dom';

const SLIDE_W = 960;

interface SimpleSlide {
  title: string;
  lines: { text: string; level: number }[];
  images: string[];
  notes: string;
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function slideSize(zip: JSZipType) {
  const pres = await zip.file('ppt/presentation.xml')?.async('string');
  const sz = pres ? xml(pres).getElementsByTagNameNS(P, 'sldSz')[0] : null;
  const cx = Number(sz?.getAttribute('cx')) || 9144000;
  const cy = Number(sz?.getAttribute('cy')) || 5143500;
  return cy / cx;
}

/** Slide files in presentation order. */
async function slidePaths(zip: JSZipType) {
  const pres = await zip.file('ppt/presentation.xml')?.async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (pres && rels) {
    const target = new Map([...xml(rels).getElementsByTagName('Relationship')].map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const ids = [...xml(pres).getElementsByTagNameNS(P, 'sldId')].map((s) => s.getAttributeNS(R, 'id'));
    const paths = ids.map((id) => target.get(id)).filter(Boolean).map((t) => `ppt/${t!.replace(/^\/?ppt\//, '').replace(/^\.\.\//, '')}`);
    if (paths.length) return paths;
  }
  return Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
}

async function readSimple(zip: JSZipType, urls: string[]): Promise<SimpleSlide[]> {
  const out: SimpleSlide[] = [];
  for (const path of await slidePaths(zip)) {
    const src = await zip.file(path)?.async('string');
    if (!src) continue;
    const doc = xml(src);
    const relsPath = path.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const relsSrc = await zip.file(relsPath)?.async('string');
    const rels = new Map(relsSrc ? [...xml(relsSrc).getElementsByTagName('Relationship')].map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']) : []);
    let title = '';
    const lines: SimpleSlide['lines'] = [];
    for (const sp of doc.getElementsByTagNameNS(P, 'sp')) {
      const ph = sp.getElementsByTagNameNS(P, 'ph')[0]?.getAttribute('type') ?? '';
      const paras = [...sp.getElementsByTagNameNS(A, 'p')].map((p) => ({
        text: [...p.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join(''),
        level: Number(p.getElementsByTagNameNS(A, 'pPr')[0]?.getAttribute('lvl') ?? 0),
      }));
      const text = paras.filter((p) => p.text.trim());
      if (!title && (ph === 'title' || ph === 'ctrTitle')) title = text.map((p) => p.text).join(' ');
      else lines.push(...text);
    }
    const images: string[] = [];
    for (const blip of doc.getElementsByTagNameNS(A, 'blip')) {
      const t = rels.get(blip.getAttributeNS(R, 'embed'));
      if (!t || !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(t)) continue;
      const f = zip.file(`ppt/${t.replace(/^\.\.\//, '')}`);
      if (!f) continue;
      const blob = await f.async('blob');
      const type = /svg$/i.test(t) ? 'image/svg+xml' : '';
      const u = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
      urls.push(u);
      images.push(u);
    }
    // speaker notes
    let notes = '';
    const notesTarget = [...rels.values()].find((t) => /notesSlide/.test(t));
    if (notesTarget) {
      const n = await zip.file(`ppt/${notesTarget.replace(/^\.\.\//, '')}`)?.async('string');
      if (n) notes = [...xml(n).getElementsByTagNameNS(A, 'p')].map((p) => [...p.getElementsByTagNameNS(A, 't')].map((t) => t.textContent).join('')).filter((t) => t.trim() && !/^\d+$/.test(t.trim())).join('\n');
    }
    out.push({ title, lines, images, notes });
  }
  return out;
}

export default function PptxViewer({ file, scale, onInfo, onError, onCover }: ViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [simple, setSimple] = useState<{ slides: SimpleSlide[]; aspect: number; why: string } | null>(null);
  const [ready, setReady] = useState(false);
  const cbs = useRef({ onInfo, onError, onCover });
  cbs.current = { onInfo, onError, onCover };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let previewer: { destroy: () => void } | null = null;
    const urls: string[] = [];
    setReady(false);
    setSimple(null);
    (async () => {
      const JSZip = (await import('jszip')).default;
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data).catch(() => {
        throw new Error('This doesn’t look like a PowerPoint .pptx file.');
      });
      if (dead) return;
      const aspect = await slideSize(zip);
      const title = file.name.replace(/\.[^.]+$/, '');
      const cover = async (text: string) => {
        if (!cbs.current.onCover) return;
        const b = (await officeThumbnail(zip)) ?? (await coverFromText(title, text, aspect, '#e58a3a'));
        if (b && !dead) cbs.current.onCover?.(b);
      };
      const fallback = async (why: string) => {
        if (dead) return;
        el.replaceChildren();
        const slides = await readSimple(zip, urls);
        if (dead) return;
        if (!slides.length) throw new Error('This deck has no slides we can read.');
        setSimple({ slides, aspect, why });
        setReady(true);
        cbs.current.onInfo({ pages: slides.length, pageWidth: SLIDE_W, pageHeight: SLIDE_W * aspect });
        void cover(slides[0].title + ' ' + slides[0].lines.map((l) => l.text).join(' '));
      };
      try {
        const { init } = await import('pptx-preview');
        if (dead) return;
        const pv = init(el, { width: SLIDE_W, height: Math.round(SLIDE_W * aspect), mode: 'list' });
        previewer = pv;
        await Promise.race([pv.preview(data), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25_000))]);
        if (dead) return;
        const slides = [...el.querySelectorAll<HTMLElement>('.pptx-preview-slide-wrapper')];
        // a deck the library "drew" as empty boxes is treated like a failure
        const drawn = slides.filter((sl) => sl.offsetWidth > 10 && sl.offsetHeight > 10 && sl.querySelector('.shape-wrapper, img, svg, table'));
        if (!slides.length || !drawn.length) {
          try {
            pv.destroy();
          } catch {
            /* ignore */
          }
          previewer = null;
          return fallback('empty');
        }
        slides.forEach((s, i) => {
          s.dataset.sdPage = String(i + 1);
          s.classList.add('sd-page', 'sd-dom-page', 'sd-slide');
        });
        // charts get a Chinese placeholder title from the library; drop it
        setTimeout(() => el.querySelectorAll('svg text').forEach((t) => t.textContent === '图表标题' && t.remove()), 400);
        setReady(true);
        cbs.current.onInfo({ pages: slides.length, pageWidth: SLIDE_W, pageHeight: SLIDE_W * aspect });
        void cover(slides[0].textContent ?? '');
      } catch (e) {
        console.warn('[studydesk] pptx-preview failed, showing the simple view', e);
        try {
          previewer?.destroy();
        } catch {
          /* already gone */
        }
        previewer = null;
        await fallback(errMsg(e));
      }
    })().catch((e) => !dead && cbs.current.onError(errMsg(e)));
    return () => {
      dead = true;
      try {
        previewer?.destroy();
      } catch {
        /* ignore */
      }
      revokeBlobUrls(el);
      urls.forEach((u) => URL.revokeObjectURL(u));
      el.replaceChildren();
    };
  }, [file]);

  return (
    <div className="sd-pages" style={{ zoom: scale, opacity: ready ? 1 : 0 }}>
      <div ref={host} className="sd-pptx-host" hidden={!!simple} />
      {simple && (
        <>
          <p className="sd-note">Simple view: this deck’s layout couldn’t be drawn, so here are its words and pictures.</p>
          {simple.slides.map((s, i) => (
            <section key={i} data-sd-page={i + 1} className="sd-page sd-dom-page sd-slide sd-simple-slide" style={{ width: SLIDE_W, minHeight: SLIDE_W * simple.aspect }}>
              <span className="sd-simple-no">{i + 1}</span>
              {s.title && <h2>{s.title}</h2>}
              <div className="sd-simple-body">
                {s.lines.length > 0 && (
                  <ul>
                    {s.lines.map((l, j) => (
                      <li key={j} style={{ marginLeft: l.level * 22 }}>
                        {l.text}
                      </li>
                    ))}
                  </ul>
                )}
                {s.images.length > 0 && (
                  <div className="sd-simple-imgs">
                    {s.images.map((u) => (
                      <img key={u} src={u} alt="" loading="lazy" decoding="async" />
                    ))}
                  </div>
                )}
              </div>
              {s.notes && <p className="sd-simple-notes">📝 {s.notes}</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
