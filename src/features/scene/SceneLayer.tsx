import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { get } from 'idb-keyval';
import { usePrefs } from '@/store/prefs';
import { Aurora } from './Aurora';
import { Particles } from './Particles';

export const YT_SCENES = [
  { id: 'jfKfPfyJRdk', name: 'Lofi Girl', emoji: '📚' },
  { id: 'NJuSStkIZBg', name: 'Cozy Rainy Night', emoji: '🌧️' },
  { id: '6KL2QZ91kAM', name: 'Nature Walk', emoji: '🏞️' },
  { id: 'AEiPpKLJIMM', name: 'Cosmic Code', emoji: '🌌' },
  { id: 'ZHMxuoUaWxM', name: 'Chill Vibes', emoji: '🎵' },
  { id: '4xDzrJKXOOY', name: 'Synthwave Drive', emoji: '🌆' },
];

export function youtubeId(input: string) {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function YouTubeBg({ id }: { id: string }) {
  const [ready, setReady] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0`;
  return (
    <motion.div className="absolute inset-0 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration: 1.2 }}>
      <iframe
        title="Background video"
        src={src}
        allow="autoplay; encrypted-media; picture-in-picture"
        onLoad={() => setTimeout(() => setReady(true), 900)}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
        style={{ width: 'max(100vw, 177.78vh)', height: 'max(100vh, 56.25vw)', transform: 'translate(-50%, -50%) scale(1.04)' }}
        tabIndex={-1}
      />
    </motion.div>
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
  const key = `${scene.kind}:${scene.youtubeId ?? scene.mediaKey ?? ''}`;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync">
        <motion.div key={key} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
          {scene.kind === 'aurora' && <Aurora />}
          {scene.kind === 'plain' && <div className="absolute inset-0 bg-bg" />}
          {scene.kind === 'youtube' && scene.youtubeId && (
            <>
              <div className="absolute inset-0 bg-black" />
              <YouTubeBg id={scene.youtubeId} />
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
