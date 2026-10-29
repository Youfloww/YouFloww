/**
 * Focus music: a small floating player (bottom-left) with brain-tuned (amplitude-modulated) music beds.
 * The audio graph exists only while playing; unmount closes it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, ChevronDown, Headphones } from 'lucide-react';
import { useFeatureData, updateFeatureData } from '@/lib/featureData';
import { useTimer } from '@/store/timer';
import { useUI, toast } from '@/store/ui';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { Slider, Switch } from '@/ui/primitives';
import { FocusEngine } from './engine';
import { DEFAULTS, MODES, TRACKS, type FocusMusicState } from './modes';

const KEY = 'focusmusic';

/**
 * Desktop: bottom-left beside the dock, lifted above the "Buy me a coffee" pill on wide screens where that pill shows.
 * Phones: top-left under the top bar (the bottom-left is the cat's study corner).
 */
const readPlacement = () => (innerWidth < 768 ? 'phone' : innerWidth >= 1024 ? 'wide' : 'tablet');

function usePlacement() {
  const [place, setPlace] = useState(readPlacement);
  useEffect(() => {
    const on = () => setPlace(readPlacement());
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return place;
}

export default function FocusMusic() {
  const saved = useFeatureData<FocusMusicState>(KEY, DEFAULTS);
  const s = { ...DEFAULTS, ...saved };
  const patch = useCallback((p: Partial<FocusMusicState>) => updateFeatureData<FocusMusicState>(KEY, DEFAULTS, (d) => void Object.assign(d, p)), []);
  const engine = useRef<FocusEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const sRef = useRef(s);
  sRef.current = s;
  const zen = useUI((u) => u.zen);
  const modeOpen = useUI((u) => u.mode);
  const focusing = useTimer((t) => t.status === 'running' && t.mode === 'focus');
  const place = usePlacement();
  const phone = place === 'phone';
  const mode = MODES.find((m) => m.id === s.mode)!;

  const play = useCallback(async () => {
    if (engine.current?.running) return;
    const e = (engine.current = new FocusEngine());
    setPlaying(true);
    setLoading(true);
    try {
      const c = sRef.current;
      await e.start({ mode: c.mode, track: c.track, intensity: c.intensity, volume: c.volume, binaural: c.binaural });
    } catch {
      toast({ title: 'Could not load the music', body: 'Check your connection and try again.', emoji: '🎧' });
      setPlaying(false);
      void e.stop(true);
      engine.current = null;
    }
    setLoading(false);
  }, []);

  const stop = useCallback((fast = false) => {
    const e = engine.current;
    engine.current = null;
    setPlaying(false);
    if (e) void e.stop(fast);
  }, []);

  useEffect(() => () => void engine.current?.stop(true), []);

  // follow the timer
  useEffect(() => {
    if (!s.follow) return;
    if (focusing && !engine.current) void play();
    else if (!focusing && engine.current) stop();
  }, [focusing, s.follow, play, stop]);

  // live parameter changes
  useEffect(() => engine.current?.setMode(s.mode, s.intensity), [s.mode, s.intensity]);
  useEffect(() => engine.current?.setVolume(s.volume), [s.volume]);
  useEffect(() => engine.current?.setBinaural(s.binaural, s.mode), [s.binaural, s.mode]);
  useEffect(() => engine.current?.changeTrack(s.track), [s.track]);

  // pause with the tab hidden? no: music should keep playing in the background.
  if (modeOpen) return null;
  const reduce = prefersReducedMotion();

  const pickMode = (id: (typeof MODES)[number]['id']) => patch({ mode: id, track: MODES.find((m) => m.id === id)!.track });

  return (
    <div
      className="pointer-events-none fixed left-3 z-[25]"
      style={{ ...(phone ? { top: 66 } : { bottom: place === 'wide' && !zen ? 70 : 14 }), opacity: zen ? 0.55 : 1 }}
      data-focusmusic
    >
      <AnimatePresence initial={false} mode="popLayout">
        {s.open ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: phone ? -12 : 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ transformOrigin: phone ? 'top left' : 'bottom left' }}
            className="glass-strong pointer-events-auto w-[min(272px,calc(100vw-24px))] rounded-3xl p-3.5 shadow-xl"
            role="region"
            aria-label="Focus music"
          >
            <div className="flex items-center gap-2.5">
              <PlayButton playing={playing} loading={loading} onClick={() => (playing ? stop() : void play())} />
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-[15px] leading-tight text-ink">{mode.emoji} {mode.label}</div>
                <div className="truncate text-[11px] text-muted">{mode.band} · tuned modulation</div>
              </div>
              <button type="button" aria-label="Minimise" onClick={() => patch({ open: false })} className="pressable grid h-8 w-8 place-items-center rounded-full text-muted hover:text-ink">
                <ChevronDown size={18} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Mode">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={m.id === s.mode}
                  title={m.blurb}
                  onClick={() => pickMode(m.id)}
                  className={cn('pressable rounded-xl px-2 py-1.5 text-left text-[12px] font-semibold transition-colors', m.id === s.mode ? 'bg-accent text-white' : 'bg-surface/70 text-ink hover:bg-surface')}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{mode.blurb}</p>

            <div className="mt-2.5 flex gap-1" role="radiogroup" aria-label="Track">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === s.track}
                  title={t.label}
                  onClick={() => patch({ track: t.id })}
                  className={cn('pressable flex-1 truncate rounded-lg py-1 text-base leading-6', t.id === s.track ? 'bg-ink/90' : 'bg-surface ring-1 ring-line hover:bg-accent-soft')}
                >
                  {t.emoji}
                </button>
              ))}
            </div>
            <div className="mt-1 text-center text-[11px] text-muted">{TRACKS.find((t) => t.id === s.track)!.label}</div>

            <div className="mt-2 space-y-1.5">
              <Row label="Intensity"><Slider value={s.intensity} onChange={(v) => patch({ intensity: v })} label="Intensity" /></Row>
              <Row label="Volume"><Slider value={s.volume} onChange={(v) => patch({ volume: v })} label="Volume" /></Row>
            </div>

            <div className="mt-2.5 space-y-1.5 border-t border-ink/10 pt-2.5 text-[12px] text-ink">
              <label className="flex items-center justify-between gap-2">
                <span>Play only while focusing</span>
                <Switch checked={s.follow} onChange={(v) => patch({ follow: v })} label="Play only while focusing" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1"><Headphones size={13} /> Soft binaural layer</span>
                <Switch checked={s.binaural} onChange={(v) => patch({ binaural: v })} label="Binaural layer" />
              </label>
              {s.binaural && <p className="text-[10.5px] text-muted">Needs stereo headphones.</p>}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pill"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-strong pointer-events-auto flex items-center gap-1.5 rounded-full p-1 pr-3 shadow-lg"
            style={{ transformOrigin: phone ? 'top left' : 'bottom left' }}
          >
            <PlayButton playing={playing} loading={loading} onClick={() => (playing ? stop() : void play())} small />
            <button type="button" onClick={() => patch({ open: true })} aria-label="Open focus music" className="pressable flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <span aria-hidden>🧠</span>
              <span className="hidden sm:inline">{playing ? mode.label : 'Focus music'}</span>
              {playing && <Pulse reduce={reduce} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[58px] text-[11px] text-muted">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** A slow, gentle breathing glow. (Deliberately not synced to the 8-16 Hz modulation: flicker that fast is unpleasant.) */
function Pulse({ reduce }: { reduce: boolean }) {
  return (
    <span className="relative grid h-3.5 w-3.5 place-items-center" aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full bg-accent/40"
        animate={reduce ? undefined : { scale: [0.6, 1.35, 0.6], opacity: [0.9, 0.2, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
    </span>
  );
}

function PlayButton({ playing, loading, onClick, small }: { playing: boolean; loading: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? 'Pause focus music' : 'Play focus music'}
      className={cn('pressable relative grid shrink-0 place-items-center rounded-full bg-accent text-white shadow-md', small ? 'h-9 w-9' : 'h-11 w-11')}
    >
      {playing && !loading && !prefersReducedMotion() && (
        <motion.span className="absolute inset-0 rounded-full border-2 border-accent" animate={{ scale: [1, 1.3], opacity: [0.5, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }} />
      )}
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : playing ? <Pause size={small ? 15 : 18} fill="currentColor" /> : <Play size={small ? 15 : 18} fill="currentColor" className="ml-0.5" />}
    </button>
  );
}
