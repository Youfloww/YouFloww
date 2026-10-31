/**
 * A YouTube window view that fills the screen like a real window: no controls, no clicks, starts muted (browsers only
 * autoplay muted video), loops, pauses while the tab is hidden and silent. The video's poster shows until it plays;
 * if it can't play (offline, blocked, a live stream that ended) `onFail` lets the seat fall back to the painting.
 */
import { useEffect, useRef, useState } from 'react';
import { thumbOf, type Scene } from './scenes';

interface YTPlayer {
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowAhead: boolean): void;
  getPlayerState(): number;
  destroy(): void;
}
interface YTApi {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
type W = Window & { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

let api: Promise<YTApi> | null = null;
/** The IFrame API script, loaded once and only when a video view opens. */
function loadApi(): Promise<YTApi> {
  return (api ??= new Promise<YTApi>((res, rej) => {
    const w = window as W;
    if (w.YT?.Player) return res(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      res(w.YT!);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      api = null;
      s.remove();
      rej(new Error('YouTube unavailable'));
    };
    document.head.appendChild(s);
  }));
}

const PLAYING = 1;
const ENDED = 0;
const PAUSED = 2;

export default function YouTubeView({ scene, sound, onFail }: { scene: Scene; sound: boolean; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState(() => thumbOf(scene, 'maxres'));
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    if (!scene.yt || !host.current) return;
    let dead = false;
    setPlaying(false);
    setPoster(thumbOf(scene, 'maxres'));
    const fail = () => !dead && failRef.current();
    // nothing after 20 s (blocked network, a stream that went quiet): give up quietly
    const slow = setTimeout(fail, 20_000);
    const el = document.createElement('div');
    host.current.appendChild(el);
    const start = scene.len ? Math.floor(60 + Math.random() * Math.max(0, scene.len - 900)) : undefined;
    loadApi()
      .then((YT) => {
        if (dead) return;
        player.current = new YT.Player(el, {
          host: 'https://www.youtube-nocookie.com',
          videoId: scene.yt,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            origin: location.origin,
            // looped by hand (ENDED → seek to 0): YouTube's own loop makes a playlist, which draws prev/next buttons
            ...(start ? { start } : {}),
          },
          events: {
            // autoplay starts it: every extra playVideo() makes YouTube draw its pause button over the view
            onReady: (e: { target: YTPlayer }) => e.target.mute(),
            onStateChange: (e: { data: number; target: YTPlayer }) => {
              if (dead) return;
              if (e.data === PLAYING) {
                clearTimeout(slow);
                setPlaying(true);
                if (soundRef.current && e.target.isMuted()) {
                  e.target.unMute();
                  e.target.setVolume(70);
                }
              } else if (e.data === ENDED) e.target.seekTo(0, true);
              else if (e.data === PAUSED && !document.hidden && soundRef.current && !e.target.isMuted()) {
                // the browser refused sound without a tap: keep the view going, muted
                e.target.mute();
                e.target.playVideo();
              }
            },
            onError: fail,
          },
        });
      })
      .catch(fail);
    // hidden and silent: no point streaming video nobody sees
    let hid = false;
    const vis = () => {
      const p = player.current;
      if (!p?.getPlayerState) return;
      if (document.hidden && p.isMuted() && p.getPlayerState() === PLAYING) {
        hid = true;
        p.pauseVideo();
      } else if (!document.hidden && hid) {
        hid = false;
        p.playVideo();
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true;
      clearTimeout(slow);
      document.removeEventListener('visibilitychange', vis);
      try {
        player.current?.destroy();
      } catch {
        // already gone
      }
      player.current = null;
      el.remove();
      host.current?.replaceChildren();
    };
  }, [scene]);

  useEffect(() => {
    const p = player.current;
    if (!p?.getPlayerState || !playing) return;
    if (sound) {
      p.unMute();
      p.setVolume(70);
    } else p.mute();
  }, [sound, playing]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* cover the screen with the 16:9 video, like the painting does */}
      <div
        ref={host}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 [&>iframe]:size-full"
        style={{ width: 'max(100vw, 177.78dvh)', height: 'max(100dvh, 56.25vw)' }}
      />
      <img
        src={poster}
        alt=""
        draggable={false}
        onError={() => setPoster(thumbOf(scene).replace('mqdefault', 'hqdefault'))}
        className="pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-[1200ms] select-none"
        style={{ opacity: playing ? 0 : 1 }}
      />
    </div>
  );
}
