/** Minimal typed event bus for app-wide moments (celebrations, mascot reactions). */
export type BusEvents = {
  'session:complete': { seconds: number; streak: 'inc' | 'reset' | 'none'; goalReached: boolean; taskText?: string | null };
  'session:early': { seconds: number };
  'break:complete': { long: boolean };
  'task:done': { text: string; x?: number; y?: number };
  'achievement': { ids: string[] };
  'mascot:say': { text: string; mood?: 'happy' | 'wow' | 'sad' | 'sleepy' | 'love'; ms?: number };
  'confetti': { x?: number; y?: number; big?: boolean };
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
    handlers.get(type)?.forEach((fn) => (fn as Handler<BusEvents[K]>)(payload));
  },
};
