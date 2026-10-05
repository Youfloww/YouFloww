let ctx: AudioContext | null = null;

/** Lazily create (and resume) the shared AudioContext. Must be called from a user gesture the first time. */
export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const hasAudioCtx = () => !!ctx;

// Unlock audio on the first interaction anywhere (iOS needs this).
if (typeof window !== 'undefined') {
  const unlock = () => {
    audioCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock);
}
