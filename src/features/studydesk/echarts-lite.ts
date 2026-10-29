/**
 * Optional tiny stand-in for `echarts`, which pptx-preview imports only to draw charts inside slides.
 * Not used unless the lead adds the vite alias described in INTEGRATION.md (saves ~1 MB per deck opened);
 * charts then show as a neat "Chart" card instead of an echarts drawing.
 */
export function init(dom: HTMLElement) {
  return {
    setOption(opt?: { title?: { text?: string } | { text?: string }[] }) {
      const t = Array.isArray(opt?.title) ? opt?.title[0]?.text : opt?.title?.text;
      const card = document.createElement('div');
      card.style.cssText =
        'position:absolute;inset:4px;display:grid;place-items:center;align-content:center;gap:6px;border:2px dashed #d9cfc6;border-radius:14px;background:#fbf8f4;color:#8a7f88;font:700 15px Nunito,system-ui,sans-serif;text-align:center';
      card.textContent = `📊 ${t && t !== '图表标题' ? t : 'Chart'}`;
      dom.replaceChildren(card);
    },
    resize() {},
    dispose() {
      dom.replaceChildren();
    },
  };
}
