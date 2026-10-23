import React, { useEffect, useRef, useState } from 'react';
import { useCat } from './brain';
import { skinOf, useStripUrl, type SkinId, type StripFile } from './skins';

/**
 * Sprite strips in /img/cat, built by tools/cat/build_strips.py from the CC0 "Cat & Dog - Free Sprites"
 * (OpenGameArt): 336x288 frames, the cat faces right, her feet at FEET in every frame.
 */
export type CatAnim = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'slide' | 'hurt' | 'dead';
/** Faces drawn on top of the standing (idle) pose; walking can only blink */
export type CatFace = 'normal' | 'blink' | 'happy' | 'sad' | 'mad' | 'love' | 'star';

export const SPRITE_FRAMES: Record<CatAnim, number> = { idle: 10, walk: 10, run: 8, jump: 8, fall: 8, slide: 10, hurt: 10, dead: 10 };
export const SPRITE_ASPECT = 336 / 288;
/** The point in a frame that stands on things (fractions of width / height) */
export const FEET = { x: 0.47, y: 0.985 };

export const stripFor = (anim: CatAnim, face: CatFace): StripFile =>
  anim === 'idle' && face !== 'normal' ? `idle-${face}` : anim === 'walk' && face === 'blink' ? 'walk-blink' : anim;

export interface CatSpriteProps {
  anim: CatAnim;
  face?: CatFace;
  /** defaults to the skin chosen in Settings */
  skin?: SkinId;
  height?: number;
  flip?: boolean;
  fps?: number;
  loop?: boolean;
  onEnd?: () => void;
  className?: string;
  onClick?: () => void;
  /** Hold one frame instead of animating (e.g. a sleeping loaf) */
  frame?: number;
  style?: React.CSSProperties;
}

export function CatSprite({ anim, face = 'normal', skin, height = 90, flip = false, fps = 12, loop = true, onEnd, className = '', onClick, frame: heldFrame, style }: CatSpriteProps) {
  const mySkin = useCat((s) => s.skin);
  const skinId = skin ?? mySkin;
  const [frame, setFrame] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // a face change keeps the frame, so a blink doesn't restart the idle sway
  useEffect(() => {
    setFrame(heldFrame ?? 0);
    if (heldFrame !== undefined) return;
    const total = SPRITE_FRAMES[anim];
    let ended = false;
    const id = window.setInterval(() => {
      setFrame((prev) => {
        if (prev + 1 < total) return prev + 1;
        if (loop) return 0;
        if (!ended) {
          ended = true;
          window.clearInterval(id);
          queueMicrotask(() => onEndRef.current?.());
        }
        return prev;
      });
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [anim, fps, loop, heldFrame]);

  const url = useStripUrl(skinId, stripFor(anim, face));
  // while a painted face loads, keep showing the plain pose rather than nothing
  const fallback = useStripUrl(skinId, anim);
  const total = SPRITE_FRAMES[anim];
  const width = Math.round(height * SPRITE_ASPECT);
  const glow = skinOf(skinId).glow;

  return (
    <div
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? 'Poke the cat' : undefined}
      aria-hidden={!onClick ? true : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      className={`select-none ${className}`}
      style={{
        width,
        height,
        backgroundImage: url || fallback ? `url(${url ?? fallback})` : undefined,
        backgroundSize: `${total * 100}% 100%`,
        backgroundPosition: `${total > 1 ? (Math.min(frame, total - 1) / (total - 1)) * 100 : 0}% 0%`,
        backgroundRepeat: 'no-repeat',
        transform: flip ? 'scaleX(-1)' : undefined,
        filter: glow,
        ...style,
      }}
    />
  );
}
