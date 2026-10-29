/** Plain text and Markdown notes in a calm reading column. Markdown is turned into React elements (never raw HTML). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { coverFromText } from '../cover';
import type { ViewerProps } from './types';

/* ------------------------------------------------------------------ */
/* A small, safe Markdown subset                                        */
/* ------------------------------------------------------------------ */
function inline(src: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    else if (m[4]) out.push(<del key={k}>{inline(t.slice(2, -2), k)}</del>);
    else if (m[5]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push(
        /^https?:\/\//i.test(href) ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {inline(label, k)}
          </a>
        ) : (
          <span key={k}>{label}</span>
        ),
      );
    }
    last = m.index + t.length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

function markdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push(
        <pre key={k++}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const Tag = `h${h[1].length}` as 'h1';
      out.push(<Tag key={k++}>{inline(h[2].replace(/\s#+$/, ''))}</Tag>);
      i++;
      continue;
    }
    if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) {
      out.push(<hr key={k++} />);
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(<blockquote key={k++}>{markdown(body.join('\n'))}</blockquote>);
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    if (li.test(line)) {
      const ordered = /\d/.test(line.match(li)![2]);
      const items: ReactNode[] = [];
      while (i < lines.length && li.test(lines[i])) {
        const [, indent, , text] = lines[i].match(li)!;
        const task = text.match(/^\[([ xX])\]\s+(.*)$/);
        items.push(
          <li key={i} style={indent.length >= 2 ? { marginLeft: Math.min(4, Math.floor(indent.length / 2)) * 20 } : undefined} className={task ? 'sd-task' : undefined}>
            {task ? (
              <>
                <span aria-hidden className="sd-box">
                  {task[1] !== ' ' ? '✓' : ''}
                </span>
                {inline(task[2])}
              </>
            ) : (
              inline(text)
            )}
          </li>,
        );
        i++;
      }
      out.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s|\s*```|\s*~~~)/.test(lines[i])) para.push(lines[i++].trim());
    if (!para.length) para.push(lines[i++]);
    out.push(<p key={k++}>{inline(para.join(' '))}</p>);
  }
  return out;
}

const isMd = (name: string) => /\.(md|markdown|mdown)$/i.test(name);

export default function TextViewer({ file, scale, onInfo, onError, onCover }: ViewerProps) {
  const [text, setText] = useState<string | null>(null);
  const cbs = useRef({ onInfo, onError, onCover });
  cbs.current = { onInfo, onError, onCover };

  useEffect(() => {
    let dead = false;
    file
      .text()
      .then((t) => {
        if (dead) return;
        setText(t);
        cbs.current.onInfo({ pages: 1, pageWidth: 0, pageHeight: 0, fluid: true });
        if (cbs.current.onCover) void coverFromText(file.name.replace(/\.[^.]+$/, ''), t.slice(0, 1200), 1.294, '#9a7bd8').then((b) => b && !dead && cbs.current.onCover?.(b));
      })
      .catch(() => !dead && cbs.current.onError('This file couldn’t be read as text.'));
    return () => {
      dead = true;
    };
  }, [file]);

  const body = useMemo(() => {
    if (text === null) return null;
    if (isMd(file.name) && text.length < 2_000_000) return markdown(text);
    // plain text: paragraphs, in chunks so a huge log stays responsive
    return text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>);
  }, [text, file.name]);

  return (
    <div className="sd-pages">
      <article data-sd-page="1" className={`sd-page sd-text ${isMd(file.name) ? 'sd-md' : 'sd-plain'}`} style={{ zoom: scale }}>
        {body}
      </article>
    </div>
  );
}
