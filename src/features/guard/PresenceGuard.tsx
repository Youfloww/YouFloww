import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTimer } from '@/store/timer';
import { pause, start } from '../timer/engine';
import { toast } from '@/store/ui';
import { useData } from '@/store/data';

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ class: string; score: number }[]> };
declare global {
  interface Window {
    cocoSsd?: { load: (o?: { base?: string }) => Promise<Detector> };
  }
}

const loadScript = (src: string) =>
  new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = Object.assign(document.createElement('script'), { src, async: true, crossOrigin: 'anonymous' });
    s.onload = () => res();
    s.onerror = rej;
    document.head.appendChild(s);
  });

let modelPromise: Promise<Detector> | null = null;
function loadModel() {
  return (modelPromise ??= (async () => {
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    return window.cocoSsd!.load({ base: 'lite_mobilenet_v2' });
  })());
}

/**
 * On-device presence detection (v2's "Accountability AI"). Runs only while a
 * focus session is active. Two missed checks in a row → auto-pause; when you
 * come back, the timer resumes on its own.
 */
export function PresenceGuard() {
  const status = useTimer((s) => s.status);
  const mode = useTimer((s) => s.mode);
  const autoPaused = useTimer((s) => s.autoPaused);
  const active = mode === 'focus' && (status === 'running' || (status === 'paused' && autoPaused));
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'off' | 'loading' | 'watching' | 'away' | 'error'>('off');

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let misses = 0;
    let cancelled = false;

    (async () => {
      try {
        setState('loading');
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
        if (cancelled) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const model = await loadModel();
        if (cancelled) return;
        setState('watching');
        const check = async () => {
          if (document.visibilityState !== 'visible' && useTimer.getState().status !== 'paused') return;
          const preds = await model.detect(v).catch(() => []);
          const here = preds.some((p) => p.class === 'person' && p.score > 0.5);
          const t = useTimer.getState();
          if (here) {
            misses = 0;
            setState('watching');
            if (t.status === 'paused' && t.autoPaused) {
              start();
              toast({ emoji: '👋', title: 'Welcome back!', body: 'Resumed your session.' });
            }
          } else if (++misses >= 2 && t.status === 'running') {
            setState('away');
            pause(true);
            toast({ emoji: '👀', title: 'Paused — you stepped away', body: 'I’ll resume when you’re back.' });
          }
        };
        timer = setInterval(check, 7000);
      } catch {
        setState('error');
        toast({ emoji: '📷', title: 'Camera unavailable', body: 'Presence guard turned off.' });
        useData.getState().updateSettings({ isAccountabilityOn: false });
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  if (state === 'off') return <video ref={video} hidden muted playsInline />;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass fixed top-20 left-4 z-20 flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-extrabold"
      title="Presence guard is watching (on-device only)"
    >
      <div className="relative size-8 overflow-hidden rounded-full bg-black">
        <video ref={video} muted playsInline className="size-full scale-x-[-1] object-cover" />
      </div>
      {state === 'away' ? <EyeOff size={14} className="text-bad" /> : <Eye size={14} className={state === 'watching' ? 'text-good' : 'text-muted'} />}
      {state === 'loading' ? 'Waking up…' : state === 'away' ? 'Away' : 'Guarding'}
    </motion.div>
  );
}
