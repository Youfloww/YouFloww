/** Small covers for the recent-files shelf (about 180 px wide WebP, a few KB each). */
export const COVER_W = 180;

export function canvasToBlob(c: HTMLCanvasElement, q = 0.78): Promise<Blob | null> {
  return new Promise((res) => {
    try {
      c.toBlob((b) => res(b), 'image/webp', q);
    } catch {
      res(null);
    }
  });
}

/** Downscale any drawable (canvas, image) into a cover. */
export async function coverFrom(src: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = COVER_W;
  c.height = Math.max(1, Math.min(COVER_W * 2, Math.round((COVER_W * h) / w)));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const b = await canvasToBlob(c);
  c.width = 0;
  return b;
}

export async function coverFromBlobImage(blob: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const out = await coverFrom(bmp, bmp.width, bmp.height);
    bmp.close();
    return out;
  } catch {
    return null;
  }
}

/** A tiny paper page with the title and the first lines of text, for documents we can't snapshot. */
export async function coverFromText(title: string, text: string, aspect = 1.3, accent = '#e07a5f'): Promise<Blob | null> {
  const c = document.createElement('canvas');
  const W = COVER_W;
  const H = Math.round(W * Math.min(1.6, Math.max(0.5, aspect)));
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 5);
  const pad = 14;
  ctx.fillStyle = '#2a1b3d';
  ctx.font = '700 13px Nunito, system-ui, sans-serif';
  const words = (title || '').split(/\s+/);
  let line = '';
  let y = pad + 14;
  const lines: string[] = [];
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W - pad * 2 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  for (const l of lines.slice(0, 2)) {
    ctx.fillText(l, pad, y);
    y += 16;
  }
  ctx.font = '500 7px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#6b6075';
  const body = text.replace(/\s+/g, ' ').trim();
  let i = 0;
  y += 4;
  while (y < H - pad && i < body.length) {
    let j = i + 1;
    while (j <= body.length && ctx.measureText(body.slice(i, j)).width < W - pad * 2) j++;
    ctx.fillText(body.slice(i, j - 1), pad, y);
    i = j - 1;
    y += 9;
  }
  if (!body) {
    ctx.fillStyle = '#e9e2ef';
    for (; y < H - pad; y += 10) ctx.fillRect(pad, y, (W - pad * 2) * (0.6 + Math.random() * 0.4), 4);
  }
  const b = await canvasToBlob(c);
  c.width = 0;
  return b;
}

/** A picture that's (almost) one flat colour, like a template's empty preview. */
async function isBlank(blob: Blob) {
  try {
    const bmp = await createImageBitmap(blob, { resizeWidth: 24, resizeHeight: 16 });
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const d = ctx.getImageData(0, 0, 24, 16).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    return max - min < 18;
  } catch {
    return true;
  }
}

/** Office files often carry their own preview picture (docProps/thumbnail.jpeg); skipped when it's blank. */
export async function officeThumbnail(zip: { file: (n: string) => { async: (t: 'blob') => Promise<Blob> } | null }): Promise<Blob | null> {
  for (const n of ['docProps/thumbnail.jpeg', 'docProps/thumbnail.jpg', 'docProps/thumbnail.png']) {
    const f = zip.file(n);
    if (!f) continue;
    const b = await f.async('blob');
    return (await isBlank(b)) ? null : coverFromBlobImage(b);
  }
  return null;
}
