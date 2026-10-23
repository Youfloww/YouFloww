import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Check, ImagePlus, Link2 } from 'lucide-react';
import { set as idbSet } from 'idb-keyval';
import { usePrefs, THEMES, type EffectId } from '@/store/prefs';
import { cn, withViewTransition } from '@/lib/utils';
import { Button, Segmented, SectionTitle, Slider, Switch } from '@/ui/primitives';
import { YT_SCENES } from './SceneLayer';
import { parseYouTube, ytThumb } from '@/lib/youtube';
import { toast } from '@/store/ui';

const EFFECTS: { id: EffectId; label: string; emoji: string }[] = [
  { id: 'snow', label: 'Snow', emoji: '❄️' },
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'sakura', label: 'Sakura', emoji: '🌸' },
  { id: 'fireflies', label: 'Fireflies', emoji: '✨' },
  { id: 'stars', label: 'Stars', emoji: '🌟' },
  { id: 'bubbles', label: 'Bubbles', emoji: '🫧' },
];

export default function ScenesPanel() {
  const p = usePrefs();
  const [link, setLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const isMedia = p.scene.kind === 'youtube' || p.scene.kind === 'image' || p.scene.kind === 'video';

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Theme</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => {
            const on = p.theme === t.id;
            return (
              <motion.button
                key={t.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => withViewTransition(() => p.set({ theme: t.id }))}
                className={cn('relative overflow-hidden rounded-3xl p-1 text-left ring-2 transition-shadow', on ? 'ring-accent' : 'ring-transparent hover:ring-line')}
                aria-pressed={on}
              >
                <div className="relative h-16 overflow-hidden rounded-[20px]" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]} 60%, ${t.swatch[2]})` }}>
                  <span className="absolute right-2 bottom-1 text-2xl drop-shadow">{t.emoji}</span>
                  {on && (
                    <motion.span layoutId="theme-check" className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-white text-ink shadow">
                      <Check size={14} strokeWidth={4} />
                    </motion.span>
                  )}
                </div>
                <p className="px-2 pt-1.5 pb-1 text-[13px] font-extrabold">{t.name}</p>
              </motion.button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
          <span>
            <span className="block text-sm font-extrabold">Follow system dark mode</span>
            <span className="block text-xs font-semibold text-muted">Switch to Midnight Bloom at night</span>
          </span>
          <Switch checked={p.autoDark} onChange={(v) => p.set({ autoDark: v })} />
        </label>
      </section>

      <section>
        <SectionTitle>Background</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {[
            { k: 'aurora' as const, label: 'Living aurora', sub: 'WebGL gradient', bg: 'linear-gradient(135deg, var(--a1), var(--a2), var(--a3))' },
            { k: 'plain' as const, label: 'Calm & plain', sub: 'Zero distraction', bg: 'var(--bg)' },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => p.set({ scene: { kind: o.k } })}
              className={cn('rounded-3xl p-1 text-left ring-2', p.scene.kind === o.k ? 'ring-accent' : 'ring-line')}
            >
              <div className="h-16 rounded-[20px] ring-1 ring-line" style={{ background: o.bg }} />
              <p className="px-2 pt-1.5 text-[13px] font-extrabold">{o.label}</p>
              <p className="px-2 pb-1 text-[11px] font-bold text-muted">{o.sub}</p>
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs font-black tracking-wider text-muted uppercase">Live wallpapers</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {YT_SCENES.map((s) => {
            const on = p.scene.kind === 'youtube' && p.scene.youtubeId === s.id && !p.scene.youtubeList;
            return (
              <motion.button
                key={s.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => p.set({ scene: { kind: 'youtube', youtubeId: s.id } })}
                className={cn('group relative overflow-hidden rounded-3xl ring-2', on ? 'ring-accent' : 'ring-transparent')}
              >
                <img src={ytThumb(s.id)} alt="" loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-1.5 text-left text-xs font-extrabold text-white">
                  {s.emoji} {s.name}
                </span>
                {on && (
                  <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-white text-ink shadow">
                    <Check size={14} strokeWidth={4} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const yt = parseYouTube(link);
            if (!yt) return toast({ emoji: '🤔', title: 'Hmm, that’s not a YouTube link' });
            p.set({ scene: { kind: 'youtube', youtubeId: yt.id, youtubeList: yt.list } });
            if (yt.list) toast({ emoji: '🎞️', title: 'Playlist wallpaper', body: 'Plays every video in order, then starts over.' });
            setLink('');
          }}
        >
          <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-line px-3">
            <Link2 size={16} className="text-muted" />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Any YouTube video or playlist as wallpaper" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-faint" />
          </div>
          <Button type="submit" variant="primary">
            Set
          </Button>
        </form>
        <Button className="mt-2 w-full" icon={<ImagePlus size={16} />} onClick={() => fileRef.current?.click()}>
          Upload your own image or video
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,video/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 120 * 1024 * 1024) return toast({ emoji: '📦', title: 'File too large', body: 'Keep it under 120MB.' });
            const key = `floww:bg:${Date.now()}`;
            await idbSet(key, f);
            p.set({ scene: { kind: f.type.startsWith('video') ? 'video' : 'image', mediaKey: key } });
            toast({ emoji: '🖼️', title: 'Wallpaper set', body: 'Saved on this device.' });
          }}
        />

        {isMedia && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-black tracking-wider text-muted uppercase">Dim wallpaper</p>
            <Slider label="Dim wallpaper" value={p.dim} min={0} max={0.6} onChange={(v) => p.set({ dim: v })} />
          </div>
        )}
      </section>

      <section>
        <SectionTitle right={<span className="text-xs font-bold text-muted">Mix & match</span>}>Ambient effects</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {EFFECTS.map((e) => {
            const on = !!p.effects[e.id];
            return (
              <motion.button
                key={e.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => p.toggleEffect(e.id)}
                aria-pressed={on}
                className={cn('flex flex-col items-center gap-1 rounded-3xl py-3 text-sm font-extrabold ring-1 transition-colors', on ? 'bg-accent-soft ring-accent' : 'bg-surface-strong/70 ring-line')}
              >
                <motion.span className="text-2xl" animate={on ? { y: [0, -4, 0] } : {}} transition={{ duration: 1.6, repeat: on ? Infinity : 0 }}>
                  {e.emoji}
                </motion.span>
                {e.label}
              </motion.button>
            );
          })}
        </div>
        {Object.values(p.effects).some(Boolean) && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-black tracking-wider text-muted uppercase">Density</p>
            <Slider label="Effect density" value={p.effectDensity} min={0.2} max={2} onChange={(v) => p.set({ effectDensity: v })} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Timer look</SectionTitle>
        <Segmented
          className="w-full"
          value={p.timerStyle}
          onChange={(v) => p.set({ timerStyle: v })}
          options={[
            { value: 'orb', label: '🫧 Liquid orb' },
            { value: 'minimal', label: '✏️ Minimal' },
          ]}
        />
        {[
          { k: 'showMascot' as const, label: 'Show Flowy', sub: 'Your little cat buddy by the timer' },
          { k: 'showQuote' as const, label: 'Quote of the day', sub: 'A small nudge under the timer' },
        ].map((o) => (
          <label key={o.k} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
            <span>
              <span className="block text-sm font-extrabold">{o.label}</span>
              <span className="block text-xs font-semibold text-muted">{o.sub}</span>
            </span>
            <Switch checked={p[o.k]} onChange={(v) => p.set({ [o.k]: v })} />
          </label>
        ))}
      </section>
    </div>
  );
}
