import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { get } from 'idb-keyval';
import { usePrefs } from '@/store/prefs';
import { toast } from '@/store/ui';
import { Aurora } from './Aurora';
import { Particles } from './Particles';
import { loadYouTubeApi, playerSource, playlistPos, stepPlaylist, type YTPlayer } from '@/lib/youtube';

export const YT_SCENES = [
  { id: 'rFZHOHl-L8A', name: 'Lofi Girl', emoji: '📚' },
  { id: 'NJuSStkIZBg', name: 'Cozy Rainy Night', emoji: '🌧️' },
  { id: '6KL2QZ91kAM', name: 'Nature Walk', emoji: '🏞️' },
  { id: 'AEiPpKLJIMM', name: 'Cosmic Code', emoji: '🌌' },
  { id: 'ZHMxuoUaWxM', name: 'Chill Vibes', emoji: '🎵' },
  { id: '4xDzrJKXOOY', name: 'Synthwave Drive', emoji: '🌆' },
];

/** Live streams get replaced over time; keep saved scenes working. */
const MOVED: Record<string, string> = { jfKfPfyJRdk: 'rFZHOHl-L8A', HuFYqnbVbzY: 'E2vONfzoyRI' };

/** Oversized so YouTube's top bar and corner logo fall outside the screen. */
const YT_FRAME = 'calc(max(100vh, 56.25vw) + 300px)';

/**
 * A video loops; a playlist plays every video in order and starts over after the last one.
 * Either way the switch happens just before YouTube's end screen could show.
 */
function YouTubeBg({ id: savedId, list }: { id: string | null; list: string | null }) {
  const id = savedId ? (MOVED[savedId] ?? savedId) : null;
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [poster, setPoster] = useState(id);

  useEffect(() => {
    let alive = true;
    let player: YTPlayer | null = null;
    let reveal: ReturnType<typeof setTimeout> | undefined;
    let kicks = 0;
    let skips = 0;
    let stepped = 0;
    let everPlayed = false;
    setPlaying(false);
    setFailed(false);
    setPoster(id);
    const fail = () => {
      if (!alive || everPlayed) return;
      setFailed(true);
      toast(
        list
          ? { emoji: '📺', title: 'That playlist won’t play here', body: 'It may be private or block embedding. Pick another scene.' }
          : { emoji: '📺', title: 'That video won’t play here', body: 'It may have ended or blocks embedding. Pick another scene.' },
      );
    };
    // Ended live streams sometimes never report an error, so give up after a while
    const giveUp = setTimeout(fail, 15_000);
    /** next video (the first after the last), or back to the start of a single one */
    const next = (p: YTPlayer) => {
      if (Date.now() - stepped < 3000) return; // already on its way
      stepped = Date.now();
      setPlaying(false);
      if (list) stepPlaylist(p, 1);
      else p.seekTo(0, true);
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
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          rel: 0,
          playsinline: 1,
          cc_load_policy: 0,
          loop: 1,
          ...(list ? src.vars : { playlist: id }),
          origin: location.origin,
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.mute();
            e.target.playVideo();
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            clearTimeout(reveal);
            const now = e.target.getVideoData?.()?.video_id;
            if (now) setPoster(now);
            if (e.data === 1) {
              everPlayed = true;
              kicks = 0;
              skips = 0;
              clearTimeout(giveUp);
              // let the title overlay fade out before we show anything
              reveal = setTimeout(() => alive && setPlaying(true), 1800);
              return;
            }
            if (e.data === 3) return; // buffering: keep showing the last frame
            setPlaying(false);
            if (e.data === 0) return next(e.target);
            // paused / cued: YouTube would show its play button or "More videos"; play on instead
            if (kicks++ < 20) e.target.playVideo();
          },
          onError: (e: { target: YTPlayer }) => {
            setPlaying(false);
            // one deleted or blocked video shouldn't stop a whole playlist
            const { count } = playlistPos(e.target);
            if (list && count > 1 && skips++ < Math.min(count, 15)) {
              stepped = 0;
              setTimeout(() => alive && next(e.target), 400);
            } else fail();
          },
        },
      });
    });

    // Move on just before the end screen appears (not for live streams)
    const tick = setInterval(() => {
      try {
        if (!player || player.getVideoData?.()?.isLive) return;
        const d = player.getDuration();
        if (d > 0 && d - player.getCurrentTime() < 1.5) next(player);
      } catch {
        /* player not ready */
      }
    }, 500);

    return () => {
      alive = false;
      clearTimeout(reveal);
      clearTimeout(giveUp);
      clearInterval(tick);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
    };
  }, [id, list]);

  if (failed) return <Aurora />;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* blurred poster while loading, buffering or switching videos */}
      {poster && <div className="absolute inset-[-40px] scale-110 bg-cover bg-center blur-2xl transition-[background-image] duration-700" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${poster}/hqdefault.jpg)` }} />}
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: playing ? 1 : 0 }} transition={{ duration: playing ? 1.4 : 0.4 }}>
        <div
          ref={host}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 [&_iframe]:size-full [&_iframe]:border-0"
          style={{ height: YT_FRAME, width: `calc(${YT_FRAME} * 1.7778)` }}
        />
      </motion.div>
    </div>
  );
}

function MediaBg({ mediaKey, kind }: { mediaKey: string; kind: 'image' | 'video' }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void get<Blob>(mediaKey).then((blob) => {
      if (blob) {
        u = URL.createObjectURL(blob);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [mediaKey]);
  if (!url) return null;
  return kind === 'image' ? (
    <motion.img src={url} alt="" className="absolute inset-0 size-full object-cover" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2 }} />
  ) : (
    <motion.video src={url} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} />
  );
}

export function SceneLayer() {
  const scene = usePrefs((s) => s.scene);
  const dim = usePrefs((s) => s.dim);
  const media = scene.kind === 'youtube' || scene.kind === 'image' || scene.kind === 'video';
  const key = `${scene.kind}:${scene.youtubeId ?? scene.mediaKey ?? ''}:${scene.youtubeList ?? ''}`;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync">
        <motion.div key={key} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
          {scene.kind === 'aurora' && <Aurora />}
          {scene.kind === 'plain' && <div className="absolute inset-0 bg-bg" />}
          {scene.kind === 'youtube' && (scene.youtubeId || scene.youtubeList) && (
            <>
              <div className="absolute inset-0 bg-black" />
              <YouTubeBg id={scene.youtubeId ?? null} list={scene.youtubeList ?? null} />
              {/* shield: nothing in the video can be hovered or clicked */}
              <div className="absolute inset-0" />
            </>
          )}
          {(scene.kind === 'image' || scene.kind === 'video') && scene.mediaKey && (
            <>
              <div className="absolute inset-0 bg-black" />
              <MediaBg mediaKey={scene.mediaKey} kind={scene.kind} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
      {media && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ background: 'radial-gradient(120% 90% at 50% 40%, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.55))', opacity: 0.4 + dim }}
        />
      )}
      <Particles />
    </div>
  );
}
