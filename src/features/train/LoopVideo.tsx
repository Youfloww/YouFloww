/** A muted, looping scenery video that costs nothing until it is on screen: no src until mounted, paused while the tab is hidden,
 *  src removed on unmount, and a still poster instead for reduced-motion / data-saver. */
import { useEffect, useMemo, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/utils';

const dataSaver = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function LoopVideo({ src, poster, className, style, paused = false }: { src: string; poster: string; className?: string; style?: React.CSSProperties; paused?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const still = useMemo(() => prefersReducedMotion() || dataSaver(), []);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const v = ref.current;
    if (still || !v) return;
    v.src = src;
    const go = () => {
      if (!document.hidden && !pausedRef.current) v.play().catch(() => {});
      else v.pause();
    };
    document.addEventListener('visibilitychange', go);
    go();
    return () => {
      document.removeEventListener('visibilitychange', go);
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, [src, still]);

  useEffect(() => {
    const v = ref.current;
    if (still || !v || !v.src) return;
    if (paused || document.hidden) v.pause();
    else v.play().catch(() => {});
  }, [paused, still]);

  if (still) return <img src={poster} alt="" aria-hidden decoding="async" className={className} style={style} />;
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" disablePictureInPicture aria-hidden tabIndex={-1} className={className} style={style} />;
}
