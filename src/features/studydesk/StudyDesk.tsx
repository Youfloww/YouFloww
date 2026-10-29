/**
 * Study Desk: open your PDFs, Word files, slides, pictures and notes right inside YouFloww and study with the
 * cat on the page and the timer in the corner. Files stay on this device (IndexedDB), nothing is uploaded.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { DoorOpen, FileUp, PictureInPicture2, Trash2 } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { cn, isTypingTarget } from '@/lib/utils';
import { CatSprite } from '../cat/CatSprite';
import { pipSupported, toggleBuddy, useBuddyWindow } from '../pip/PipTimer';
import { ACCEPT, KIND_META, forget, kindOf, listRecents, loadRecentFile, prettySize, remember, type DocKind, type Recent } from './recents';
import { Reader } from './Reader';
import { DeskTimer } from './DeskTimer';
import './studydesk.css';

interface Open {
  file: File;
  kind: DocKind;
  recent: Recent | null;
  key: number;
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function Thumb({ r }: { r: Recent }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!r.thumb) return setUrl(null);
    const u = URL.createObjectURL(r.thumb);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [r.thumb]);
  const meta = KIND_META[r.kind];
  return url ? (
    <img src={url} alt="" decoding="async" draggable={false} className="size-full object-cover object-top" />
  ) : (
    <span className="grid size-full place-items-center text-4xl" style={{ background: `color-mix(in oklab, ${meta.tint} 14%, #fffdf8)` }}>
      {meta.emoji}
    </span>
  );
}

export default function StudyDesk() {
  const [open, setOpen] = useState<Open | null>(null);
  const [recents, setRecents] = useState<Recent[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const pip = useBuddyWindow();
  const canPip = pipSupported();

  const refresh = useCallback(() => void listRecents().then(setRecents), []);
  useEffect(refresh, [refresh]);

  const openFiles = useCallback(
    async (files: File[]) => {
      const ok: { f: File; kind: DocKind }[] = [];
      for (const f of files) {
        const kind = kindOf(f.name, f.type);
        if (kind === 'legacy') toast({ emoji: '📄', title: `Old ${f.name.split('.').pop()?.toUpperCase()} files can’t be opened here`, body: 'Save it as PDF, .docx or .pptx and drop it in again.' });
        else if (!kind) toast({ emoji: '🤔', title: 'That file type isn’t supported', body: 'Try a PDF, Word (.docx), PowerPoint (.pptx), image, .txt or .md file.' });
        else ok.push({ f, kind });
      }
      if (!ok.length) return;
      // open the first one right away, remember all of them
      const [first, ...rest] = ok;
      setOpen({ file: first.f, kind: first.kind, recent: null, key: Date.now() });
      const r = await remember(first.f, first.kind);
      setOpen((o) => (o && o.file === first.f ? { ...o, recent: r } : o));
      for (const x of rest) await remember(x.f, x.kind);
      refresh();
    },
    [refresh],
  );

  const openRecent = async (r: Recent) => {
    const f = await loadRecentFile(r);
    if (!f) {
      toast({ emoji: '🫥', title: 'That file is gone', body: 'Your browser cleared it. Open it again from your files.' });
      await forget(r.id);
      return refresh();
    }
    setOpen({ file: f, kind: r.kind, recent: r, key: Date.now() });
    void remember(f, r.kind).then((fresh) => setOpen((o) => (o && o.file === f ? { ...o, recent: fresh } : o)));
  };

  const close = useCallback(() => {
    setOpen(null);
    refresh();
  }, [refresh]);

  // drag & drop anywhere on the desk
  const onDragEnter = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length) void openFiles(files);
  };

  // O pops the buddy out from the desk too (the app's own O key is off while a mode is open)
  useEffect(() => {
    if (open) return; // the reader has its own keys
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || e.key.toLowerCase() !== 'o') return;
      const ui = useUI.getState();
      if (ui.palette || ui.confirm || ui.completion) return;
      e.preventDefault();
      void toggleBuddy();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  const leave = () => useUI.getState().set({ mode: null });

  return (
    <div
      className="sd-root fixed inset-0 z-[45] overflow-hidden bg-bg text-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Study Desk"
      onDragEnter={onDragEnter}
      onDragOver={(e) => [...e.dataTransfer.types].includes('Files') && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="sd-glow pointer-events-none absolute inset-0" aria-hidden />
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void openFiles(files);
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div key={`r${open.key}`} className="absolute inset-0" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.25 }}>
            <Reader file={open.file} kind={open.kind} recent={open.recent} onClose={close} />
          </motion.div>
        ) : (
          <motion.div key="shelf" className="absolute inset-0 overflow-y-auto overscroll-contain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {/* top */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 sm:px-5">
              <button onClick={leave} className="glass pressable flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-extrabold" title="Back to YouFloww (Esc)">
                <DoorOpen size={17} /> <span className="hidden sm:inline">Back to YouFloww</span>
              </button>
              <DeskTimer compact className="relative" />
            </div>

            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 px-4 pb-16 sm:px-6">
              {/* hero: the cat on a little stack of books */}
              <section className="flex flex-col items-center gap-1 pt-2 text-center">
                <div className="sd-hero" aria-hidden>
                  <span className="sd-hero-mug">☕</span>
                  <span className="sd-hero-plant">🪴</span>
                  <div className="sd-hero-cat">
                    <CatSprite anim="idle" face="happy" height={96} />
                  </div>
                  <div className="sd-books">
                    <span style={{ '--c': '#e9967a', '--w': '168px', '--r': '-2deg' } as CSSProperties} />
                    <span style={{ '--c': '#9cc5a1', '--w': '196px', '--r': '1.5deg' } as CSSProperties} />
                    <span style={{ '--c': '#c3b1e8', '--w': '182px', '--r': '-1deg' } as CSSProperties} />
                  </div>
                </div>
                <h1 className="font-display text-[30px] leading-tight font-semibold sm:text-[40px]">Your Study Desk</h1>
                <p className="max-w-[460px] text-[15px] font-bold text-muted">Open your notes, PDFs, Word files or slides and study with your buddy keeping you company.</p>
              </section>

              {/* drop zone */}
              <button
                onClick={() => input.current?.click()}
                className={cn('sd-drop pressable group flex flex-col items-center gap-2 rounded-[28px] px-5 py-7 text-center transition-colors', dragging && 'sd-drop-on')}
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_10px_30px_-10px_var(--accent)] transition-transform group-hover:-translate-y-0.5">
                  <FileUp size={26} />
                </span>
                <span className="font-display text-xl font-semibold">Open a file or drop it here</span>
                <span className="flex flex-wrap justify-center gap-1.5 text-xs font-extrabold text-muted">
                  {(['pdf', 'docx', 'pptx', 'image', 'text'] as DocKind[]).map((k) => (
                    <span key={k} className="rounded-full bg-line px-2.5 py-1">
                      {KIND_META[k].emoji} {k === 'text' ? '.txt / .md' : KIND_META[k].label}
                    </span>
                  ))}
                </span>
                <span className="text-xs font-bold text-muted">🔒 Your files stay on this device. Nothing is uploaded.</span>
              </button>

              {/* floating buddy */}
              {canPip && (
                <div className="glass flex flex-col items-center gap-3 rounded-[28px] p-4 sm:flex-row sm:p-5">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft">
                    <PictureInPicture2 size={26} />
                  </span>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-display text-lg font-semibold">Studying in another app?</p>
                    <p className="text-sm font-bold text-muted">Pop out a tiny window with your cat and timer that floats on top of everything: PDF readers, Word, Notion, anything.</p>
                  </div>
                  <button onClick={() => void toggleBuddy()} className={cn('pressable h-11 shrink-0 rounded-2xl px-5 font-extrabold', pip ? 'bg-line' : 'bg-accent text-accent-ink')}>
                    {pip ? 'Bring buddy back' : 'Pop out buddy'}
                  </button>
                </div>
              )}

              {/* recents */}
              <section aria-labelledby="sd-recent">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 id="sd-recent" className="font-display text-xl font-semibold">
                    On your desk
                  </h2>
                  {!!recents?.length && <span className="text-xs font-bold text-muted">Saved on this device</span>}
                </div>
                {recents === null ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[0, 1].map((i) => (
                      <div key={i} className="sd-skeleton aspect-[3/4] rounded-3xl" />
                    ))}
                  </div>
                ) : recents.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-[28px] border-2 border-dashed border-line px-4 py-8 text-center">
                    <span className="text-3xl">🗂️</span>
                    <p className="font-display text-lg font-semibold">Nothing here yet</p>
                    <p className="text-sm font-bold text-muted">Files you open show up here, and reopen at the page you stopped on.</p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {recents.map((r) => (
                      <li key={r.id} className="group relative">
                        <button onClick={() => void openRecent(r)} className="glass pressable flex w-full flex-col overflow-hidden rounded-3xl text-left">
                          <span className="sd-cover relative block aspect-[4/3] w-full overflow-hidden">
                            <Thumb r={r} />
                            <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10.5px] font-black text-white" style={{ background: KIND_META[r.kind].tint }}>
                              {KIND_META[r.kind].label}
                            </span>
                          </span>
                          <span className="flex flex-col gap-0.5 px-3 py-2.5">
                            <span className="truncate text-sm font-extrabold" title={r.name}>
                              {r.name}
                            </span>
                            <span className="truncate text-[11.5px] font-bold text-muted">
                              {r.pages > 1 ? `p. ${r.page} of ${r.pages} · ` : ''}
                              {ago(r.openedAt)} · {prettySize(r.size)}
                            </span>
                          </span>
                          {r.pages > 1 && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-accent" style={{ width: `${(r.page / r.pages) * 100}%` }} aria-hidden />}
                        </button>
                        <button
                          onClick={async () => {
                            await forget(r.id);
                            refresh();
                          }}
                          aria-label={`Remove ${r.name} from the desk`}
                          title="Remove from desk"
                          className="glass-strong pressable absolute top-2 right-2 grid size-8 place-items-center rounded-full text-muted opacity-100 transition-opacity hover:text-bad sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* drop overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-[60] grid place-items-center bg-bg/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="sd-drop sd-drop-on flex flex-col items-center gap-2 rounded-[32px] px-10 py-8 text-center">
              <span className="text-5xl">📥</span>
              <span className="font-display text-2xl font-semibold">Drop to open</span>
              <span className="text-sm font-bold text-muted">It stays on this device</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
