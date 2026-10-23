import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Minus, X, Maximize2, SkipBack, SkipForward } from 'lucide-react';
import { usePrefs } from '@/store/prefs';
import { cn } from '@/lib/utils';
import { loadYouTubeApi, playerSource, playlistPos, stepPlaylist, type YTPlayer } from '@/lib/youtube';
import { clampRect, usePointerDrag } from '@/ui/Window';

const BAR = 40;
const sizeFor = (mini: boolean, list = false) => {
  const w = mini ? (list ? 270 : 220) : Math.min(340, innerWidth - 32);
  return { w, h: mini ? BAR : BAR + Math.round((w * 9) / 16) };
};
/** The title bar always stays on screen, so the player can always be dragged back. */
const place = (x: number, y: number, mini: boolean, list = false) => {
  const s = sizeFor(mini, list);
  const r = clampRect({ x, y, ...s }, s, 100);
  return { x: r.x, y: r.y };
};

interface NowPlaying {
  title: string;
  index: number;
  count: number;
}

/** The YouTube player itself, driven through the IFrame API so playlists can be stepped through. */
function Screen({ id, list, playerRef, onInfo }: { id: string | null; list: string | null; playerRef: React.RefObject<YTPlayer | null>; onInfo: (n: NowPlaying) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const info = useRef(onInfo);
  info.current = onInfo;

  useEffect(() => {
    let alive = true;
    let player: YTPlayer | null = null;
    const report = (p: YTPlayer) => {
      if (!alive) return;
      const { index, count } = playlistPos(p);
      info.current({ title: p.getVideoData?.()?.title ?? '', index, count });
    };
    void loadYouTubeApi().then((YT) => {
      if (!alive || !host.current) return;
      const el = document.createElement('div');
      host.current.replaceChildren(el);
      const src = playerSource({ id, list });
      player = new YT.Player(el, {
        ...(src.videoId ? { videoId: src.videoId } : {}),
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        // a playlist repeats from the first video after the last one
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin, ...(list ? { ...src.vars, loop: 1 } : {}) },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            playerRef.current = e.target;
            e.target.playVideo();
            report(e.target);
          },
          onStateChange: (e: { target: YTPlayer }) => report(e.target),
        },
      });
    });
    return () => {
      alive = false;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [id, list, playerRef]);

  return <div ref={host} className="size-full [&_iframe]:size-full [&_iframe]:border-0" />;
}

/** Floating, draggable YouTube player for music/podcasts (v2's PiP player, reborn). */
export function MusicPlayer() {
  const mv = usePrefs((s) => s.musicVideo);
  const set = usePrefs((s) => s.set);
  const [mini, setMini] = useState(false);
  const [now, setNow] = useState<NowPlaying>({ title: '', index: 0, count: 0 });
  const player = useRef<YTPlayer | null>(null);
  const list = !!mv.list;
  const [pos, setPos] = useState(() => place(mv.x, mv.y, false));
  const base = useRef(pos);
  const live = useRef(pos);
  live.current = pos;

  useEffect(() => {
    const onResize = () => setPos((p) => place(p.x, p.y, mini, list));
    onResize();
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [mini, list]);

  useEffect(() => setNow({ title: '', index: 0, count: 0 }), [mv.id, mv.list]);
  const many = now.count > 1;
  const step = (dir: 1 | -1) => player.current && stepPlaylist(player.current, dir);

  const drag = usePointerDrag({
    onStart: () => (base.current = live.current),
    onMove: (dx, dy) => setPos(place(base.current.x + dx, base.current.y + dy, mini, list)),
    onEnd: () => set({ musicVideo: { ...usePrefs.getState().musicVideo, ...live.current } }),
  });

  return (
    <AnimatePresence>
      {mv.open && (mv.id || mv.list) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="glass-strong fixed z-30 overflow-hidden rounded-3xl"
          style={{ left: pos.x, top: pos.y, width: sizeFor(mini, list).w }}
        >
          <div
            {...drag.handlers}
            className={cn('flex touch-none items-center gap-1 px-2.5', drag.active ? 'cursor-grabbing' : 'cursor-grab')}
            style={{ height: BAR }}
          >
            <GripHorizontal size={16} className="text-faint" />
            <span className="min-w-0 flex-1 truncate text-xs font-black text-muted" title={now.title || undefined}>
              🎵 {many && <span className="text-accent tabular-nums">{now.index + 1}/{now.count} · </span>}
              {now.title || 'Now playing'}
            </span>
            {many && (
              <>
                <button aria-label="Previous video" onClick={() => step(-1)} className="grid size-7 place-items-center rounded-lg text-ink hover:bg-line">
                  <SkipBack size={14} />
                </button>
                <button aria-label="Next video" onClick={() => step(1)} className="grid size-7 place-items-center rounded-lg text-ink hover:bg-line">
                  <SkipForward size={14} />
                </button>
              </>
            )}
            <button aria-label={mini ? 'Expand' : 'Minimise'} onClick={() => setMini((m) => !m)} className="grid size-7 place-items-center rounded-lg text-ink hover:bg-line">
              {mini ? <Maximize2 size={13} /> : <Minus size={14} />}
            </button>
            <button aria-label="Close player" onClick={() => set({ musicVideo: { ...mv, open: false } })} className="grid size-7 place-items-center rounded-lg text-ink hover:bg-line">
              <X size={14} />
            </button>
          </div>
          <div className={cn('aspect-video w-full bg-black transition-all', mini && 'h-0 aspect-auto', drag.active && 'pointer-events-none')}>
            <Screen id={mv.id} list={mv.list ?? null} playerRef={player} onInfo={setNow} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
