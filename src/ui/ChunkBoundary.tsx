/**
 * Catches a lazy part of the app that fails to load or crashes (offline, or a new version replaced its files),
 * so one broken world never takes the whole app down with it. Shows a small card instead of a white screen.
 */
import { Component, type ReactNode } from 'react';
import { useUI } from '@/store/ui';
import { whenNotFocusing } from '@/features/timer/engine';

const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(e.message);

export class ChunkBoundary extends Component<{ children: ReactNode; name: string }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}]`, error);
  }

  private close = () => {
    useUI.getState().set({ mode: null });
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    return (
      <div className="fixed inset-x-0 bottom-[calc(110px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
        <div role="alert" className="glass-strong flex max-w-[420px] items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-3.5">
          <span className="text-xl">{chunk ? '✨' : '😿'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{chunk ? 'YouFloww was just updated' : 'This part hit a snag'}</p>
            <p className="text-[13px] font-semibold text-muted">
              {chunk ? 'Refresh to open it. A running session waits until it ends.' : 'The rest of the app is fine.'}
            </p>
          </div>
          {chunk && (
            <button onClick={() => whenNotFocusing(() => location.reload())} className="pressable rounded-xl bg-accent px-3 py-1.5 text-sm font-extrabold text-accent-ink">
              Refresh
            </button>
          )}
          <button onClick={this.close} className="pressable rounded-xl px-2.5 py-1.5 text-sm font-extrabold text-muted hover:text-ink">
            Close
          </button>
        </div>
      </div>
    );
  }
}
