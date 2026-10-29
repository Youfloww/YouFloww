/**
 * Feature plug-ins. Any folder in src/features may ship a tiny `meta.ts` (no heavy imports in it!):
 * it is found automatically, so a feature never has to edit shared files to appear in the app.
 *
 * - kind 'mode':  a full-screen place (café, flights, train, study desk, ...). One at a time; its code is
 *                 downloaded when it is opened and fully unmounted when the person leaves.
 * - kind 'layer': a piece that lives on top of the normal app (the garden strip, the cat's desk, ...).
 *                 Loaded only while it is switched on.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface FeatureMeta {
  id: string;
  label: string;
  emoji: string;
  /** one short line for the Worlds launcher */
  description: string;
  kind: 'mode' | 'layer';
  /** launcher position (lower first) */
  order?: number;
  /** layers: shown unless the person switches them off */
  defaultOn?: boolean;
  /** a keyboard shortcut that opens the mode (single lowercase letter) */
  key?: string;
  load: () => Promise<{ default: ComponentType }>;
}

const found = import.meta.glob<{ meta: FeatureMeta }>('./*/meta.ts', { eager: true });

export const FEATURES: FeatureMeta[] = Object.values(found)
  .map((m) => m.meta)
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

export const MODES = FEATURES.filter((f) => f.kind === 'mode');
export const LAYERS = FEATURES.filter((f) => f.kind === 'layer');

const cache = new Map<string, LazyExoticComponent<ComponentType>>();
/** The same lazy component every time, so React keeps it mounted across re-renders. */
export function lazyFeature(f: FeatureMeta) {
  let c = cache.get(f.id);
  if (!c) cache.set(f.id, (c = lazy(f.load)));
  return c;
}

/** Warm a mode's code before it is opened (hover on its launcher card). */
export function prefetchFeature(f: FeatureMeta) {
  void f.load().catch(() => {});
}
