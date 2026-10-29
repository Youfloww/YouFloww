/**
 * Recent files, kept on this device only (IndexedDB): the file itself, where you stopped, and a small
 * thumbnail. Nothing here is synced or uploaded.
 */
import { createStore, del, get, set } from 'idb-keyval';

export type DocKind = 'pdf' | 'docx' | 'pptx' | 'image' | 'text';

export interface Recent {
  id: string;
  name: string;
  kind: DocKind;
  size: number;
  type: string;
  openedAt: number;
  /** last page you were on (1-based) */
  page: number;
  pages: number;
  thumb?: Blob;
}

const MAX_FILES = 12;
/** bigger files still open, they just aren't remembered */
const MAX_FILE_BYTES = 120 * 1024 * 1024;
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;

let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore('youfloww-studydesk', 'desk'));
const LIST = 'recents';
const fileKey = (id: string) => `file:${id}`;

// one write at a time, so quick page turns never overwrite each other
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>) => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
};

const readList = async () => ((await get<Recent[]>(LIST, db()).catch(() => undefined)) ?? []).filter((r) => r && r.id);

export const listRecents = () => readList().then((l) => l.sort((a, b) => b.openedAt - a.openedAt));

export function idFor(f: File) {
  const s = `${f.name}|${f.size}|${f.lastModified}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}${f.size.toString(36)}`;
}

/** Save a newly opened file. Returns its entry (keeps the page you were on if it was opened before). */
export function remember(f: File, kind: DocKind): Promise<Recent> {
  return serial(async () => {
    const id = idFor(f);
    const list = await readList();
    const old = list.find((r) => r.id === id);
    const entry: Recent = { id, name: f.name, kind, size: f.size, type: f.type, openedAt: Date.now(), page: old?.page ?? 1, pages: old?.pages ?? 0, thumb: old?.thumb };
    if (f.size > MAX_FILE_BYTES) return entry;
    try {
      if (!old) await set(fileKey(id), f, db());
      let next = [entry, ...list.filter((r) => r.id !== id)];
      // forget the oldest when there are too many or they're too big together
      let total = 0;
      const keep: Recent[] = [];
      for (const r of next) {
        total += r.size;
        if (keep.length < MAX_FILES && total <= MAX_TOTAL_BYTES) keep.push(r);
        else await del(fileKey(r.id), db()).catch(() => {});
      }
      next = keep;
      await set(LIST, next, db());
    } catch {
      /* storage full or private mode: the file still opens */
    }
    return entry;
  });
}

export function patchRecent(id: string, patch: Partial<Omit<Recent, 'id'>>) {
  return serial(async () => {
    const list = await readList();
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    await set(LIST, list, db()).catch(() => {});
  });
}

export async function loadRecentFile(r: Recent): Promise<File | null> {
  const b = await get<Blob>(fileKey(r.id), db()).catch(() => undefined);
  if (!b) return null;
  return b instanceof File ? b : new File([b], r.name, { type: r.type });
}

export function forget(id: string) {
  return serial(async () => {
    const list = await readList();
    await set(
      LIST,
      list.filter((r) => r.id !== id),
      db(),
    ).catch(() => {});
    await del(fileKey(id), db()).catch(() => {});
  });
}

/* ------------------------------------------------------------------ */
/* What kind of file is it?                                             */
/* ------------------------------------------------------------------ */
const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

export function kindOf(name: string, type: string): DocKind | 'legacy' | null {
  const e = ext(name);
  if (e === 'pdf' || type === 'application/pdf') return 'pdf';
  if (e === 'docx' || e === 'docm' || e === 'dotx') return 'docx';
  if (e === 'pptx' || e === 'ppsx' || e === 'potx') return 'pptx';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'].includes(e) || (type.startsWith('image/') && !type.includes('heic'))) return 'image';
  if (['txt', 'md', 'markdown', 'mdown', 'text', 'csv', 'log'].includes(e) || type.startsWith('text/')) return 'text';
  if (['doc', 'ppt', 'xls', 'xlsx', 'odt', 'odp', 'rtf', 'pages', 'key'].includes(e)) return 'legacy';
  return null;
}

export const ACCEPT = '.pdf,.docx,.pptx,.ppsx,.txt,.md,.markdown,.csv,image/*,application/pdf';

export const KIND_META: Record<DocKind, { label: string; emoji: string; tint: string }> = {
  pdf: { label: 'PDF', emoji: '📕', tint: '#e8655a' },
  docx: { label: 'Word', emoji: '📘', tint: '#4a7fd6' },
  pptx: { label: 'Slides', emoji: '📙', tint: '#e58a3a' },
  image: { label: 'Image', emoji: '🖼️', tint: '#58a776' },
  text: { label: 'Notes', emoji: '📝', tint: '#9a7bd8' },
};

export function prettySize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
