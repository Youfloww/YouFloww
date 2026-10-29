/** Minimal typed event bus for app-wide moments (celebrations, mascot reactions). */
export type BusEvents = {
  'session:start': { quick: boolean };
  'session:complete': { seconds: number; streak: 'inc' | 'reset' | 'none'; goalReached: boolean; taskText?: string | null };
  'session:early': { seconds: number };
  'break:complete': { long: boolean };
  'task:done': { text: string; x?: number; y?: number };
  'achievement': { ids: string[] };
  'mascot:say': { text: string; mood?: 'happy' | 'wow' | 'sad' | 'sleepy' | 'love'; ms?: number };
  'confetti': { x?: number; y?: number; big?: boolean };
  /** the cat's journey: bond level ups, a partner, kittens */
  'cat:event': { kind: 'level' | 'partner' | 'expecting' | 'born' | 'kitten'; level?: number; names?: string[] };
  /** fish coins moved (src/features/economy) */
  'wallet:earn': { amount: number; reason: string };
  'wallet:spend': { amount: number; reason: string };
  /** the tab was hidden / shown again; `focusing` = a focus session was running */
  'tab:away': { focusing: boolean };
  'tab:back': { focusing: boolean; awayMs: number };
  /** a full-screen mode (src/features/registry) opened or closed */
  'mode:open': { id: string };
  'mode:close': { id: string };
};

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof BusEvents, Set<Handler<never>>>();

export const bus = {
  on<K extends keyof BusEvents>(type: K, fn: Handler<BusEvents[K]>) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(fn as Handler<never>);
    return () => handlers.get(type)!.delete(fn as Handler<never>);
  },
  emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]) {
    // one broken listener must never silence the others (sounds, confetti, the cat)
    handlers.get(type)?.forEach((fn) => {
      try {
        (fn as Handler<BusEvents[K]>)(payload);
      } catch (e) {
        console.error(`[floww] ${String(type)} listener failed`, e);
      }
    });
  },
};
