/**
 * Per-feature saved data. Each feature keeps its state under its own key in the user's data
 * (data.garden, data.catHome, ...): it is saved locally for guests and synced to the cloud when signed in.
 * Keep it small (the whole user document must stay well under 1 MB): no images, no long logs.
 */
import { useData } from '@/store/data';

/** Read a feature's saved state (re-renders when it changes). */
export function useFeatureData<T>(key: string, fallback: T): T {
  const v = useData((s) => s.data[key] as T | undefined);
  return v ?? fallback;
}

/** Read without subscribing (event handlers, timers). */
export function getFeatureData<T>(key: string, fallback: T): T {
  return (useData.getState().data[key] as T | undefined) ?? fallback;
}

/** Change a feature's saved state. `fn` edits a draft copy; it is saved and synced afterwards. */
export function updateFeatureData<T>(key: string, fallback: T, fn: (draft: T) => void) {
  useData.getState().mutate((d) => {
    const cur = (d[key] as T | undefined) ?? structuredClone(fallback);
    fn(cur);
    d[key] = cur;
  });
}
