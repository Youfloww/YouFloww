/** Word (.docx) with docx-preview: real pages on a computer, one reflowing column on a phone. */
import { useEffect, useRef, useState } from 'react';
import { coverFromText } from '../cover';
import { errMsg, type ViewerProps } from './types';
import { revokeBlobUrls } from './dom';

export default function DocxViewer({ file, scale, reflow, onInfo, onError, onCover }: ViewerProps) {
  const body = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const cbs = useRef({ onInfo, onError, onCover });
  cbs.current = { onInfo, onError, onCover };

  useEffect(() => {
    const host = body.current;
    const css = styles.current;
    if (!host || !css) return;
    let dead = false;
    setReady(false);
    (async () => {
      const { renderAsync } = await import('docx-preview');
      const data = await file.arrayBuffer();
      if (dead) return;
      await renderAsync(data, host, css, {
        className: 'sd-docx',
        inWrapper: false,
        ignoreWidth: reflow,
        ignoreHeight: reflow,
        breakPages: !reflow,
        renderHeaders: !reflow,
        renderFooters: !reflow,
        renderFootnotes: true,
        renderEndnotes: true,
        renderComments: false,
        useBase64URL: false,
        experimental: true,
      });
      if (dead) return;
      // Word bullets use private-use Symbol / Wingdings glyphs that browsers can't draw
      const GLYPHS: Record<string, string> = { '\uf0b7': '•', '\uf0a7': '▪', '\uf0d8': '➢', '\uf0fc': '✓', '\uf076': '❖', '\uf0a8': '◦', '\uf06e': '■', '\uf0e8': '➔', '\uf0d2': '◆' };
      css.querySelectorAll('style').forEach((st) => {
        const t = st.textContent ?? '';
        if (!/[\uf000-\uf0ff]/.test(t)) return;
        st.textContent = t.replace(/content: "([\uf000-\uf0ff])/g, (_, g: string) => `content: "${GLYPHS[g] ?? '•'}`).replace(/font-family: (Symbol|Wingdings[^;]*);/g, '');
      });
      const pages = [...host.querySelectorAll<HTMLElement>(':scope > section.sd-docx, :scope > article > section.sd-docx')];
      const list = pages.length ? pages : [host];
      list.forEach((p, i) => {
        p.dataset.sdPage = String(i + 1);
        p.classList.add('sd-page', 'sd-dom-page');
      });
      const first = list[0];
      // measure at 100% (the host is zoomed)
      const z = host.style.zoom;
      host.style.zoom = '1';
      const w = first.offsetWidth || 816;
      const h = first.offsetHeight || 1056;
      host.style.zoom = z;
      setReady(true);
      cbs.current.onInfo({ pages: list.length, pageWidth: reflow ? 0 : w, pageHeight: reflow ? 0 : h, fluid: reflow });
      if (cbs.current.onCover) {
        // (Word's own docProps thumbnail is often a stale blank template page, so draw our own)
        const title = file.name.replace(/\.[^.]+$/, '');
        const b = await coverFromText(title, first.textContent?.slice(0, 900) ?? '', 1.294, '#4a7fd6');
        if (b && !dead) cbs.current.onCover?.(b);
      }
    })().catch((e) => !dead && cbs.current.onError(/zip|central directory|end of data/i.test(errMsg(e)) ? 'This doesn’t look like a Word .docx file.' : errMsg(e)));
    return () => {
      dead = true;
      revokeBlobUrls(host, css);
      host.replaceChildren();
      css.replaceChildren();
    };
  }, [file, reflow]);

  return (
    <>
      <div ref={styles} hidden />
      <div ref={body} className={reflow ? 'sd-docx-host sd-reflow' : 'sd-pages sd-docx-host'} style={{ zoom: scale, opacity: ready ? 1 : 0 }} />
    </>
  );
}
