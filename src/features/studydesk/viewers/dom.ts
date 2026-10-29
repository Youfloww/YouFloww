/** Helpers for viewers that render documents as HTML (Word, slides). */

/** Free every blob: URL a renderer left inside these nodes (images, embedded fonts). */
export function revokeBlobUrls(...roots: (HTMLElement | null)[]) {
  const seen = new Set<string>();
  for (const root of roots) {
    if (!root) continue;
    root.querySelectorAll<HTMLElement>('[src^="blob:"], [href^="blob:"]').forEach((el) => {
      const u = el.getAttribute('src') ?? el.getAttribute('href');
      if (u) seen.add(u);
    });
    const html = root.innerHTML;
    for (const m of html.matchAll(/blob:[^"')\s]+/g)) seen.add(m[0].replace(/&quot;$/, ''));
  }
  seen.forEach((u) => URL.revokeObjectURL(u));
}

/** Thumbnail by cloning a rendered page and shrinking it with a transform (no re-render needed). */
export function cloneThumb(scroller: HTMLElement, page: number, host: HTMLElement, width: number) {
  const src = scroller.querySelector<HTMLElement>(`[data-sd-page="${page}"]`);
  if (!src) return;
  const zoomed = src.closest<HTMLElement>('[style*="zoom"]');
  const z = Number(zoomed?.style.zoom) || 1;
  const w = src.offsetWidth || 1;
  const h = src.offsetHeight || 1;
  const s = width / w;
  const clone = src.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-sd-page');
  clone.removeAttribute('id');
  clone.style.cssText += `;position:absolute;left:0;top:0;margin:0;width:${w}px;height:${h}px;transform:scale(${s});transform-origin:0 0;pointer-events:none;box-shadow:none;zoom:1;text-align:left`;
  const wrap = document.createElement('div');
  wrap.className = 'sd-thumb-clone';
  wrap.style.cssText = `position:relative;overflow:hidden;width:${width}px;height:${Math.round(h * s)}px`;
  wrap.append(clone);
  host.append(wrap);
  void z;
  return () => wrap.remove();
}
