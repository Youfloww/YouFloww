import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Upload, Youtube, Volume2, VolumeX } from 'lucide-react';
import { get, set, del } from 'idb-keyval';
import { usePrefs } from '@/store/prefs';
import { useData } from '@/store/data';
import { TRACKS, PRESETS, useMixerStatus, customTrack, setCustomMusic, hasCustomMusic, type Track } from '@/audio/mixer';
import { previewPack } from '@/audio/sfx';
import { cn } from '@/lib/utils';
import { Button, Segmented, SectionTitle, Slider, Switch } from '@/ui/primitives';
import { youtubeId } from '../scene/SceneLayer';
import { toast } from '@/store/ui';

function Bars({ on }: { on: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-current"
          animate={on ? { height: ['30%', '100%', '45%', '80%', '30%'] } : { height: '30%' }}
          transition={{ duration: 1 + i * 0.2, repeat: on ? Infinity : 0, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

function TrackCard({ track }: { track: Track }) {
  const on = usePrefs((s) => !!s.mixer.on[track.id]);
  const vol = usePrefs((s) => s.mixer.volumes[track.id] ?? 0.5);
  const { toggleTrack, setVolume } = usePrefs.getState();
  const status = useMixerStatus((s) => s.status[track.id]);
  const vinyl = track.id === 'vinyl';

  return (
    <motion.div layout className={cn('relative overflow-hidden rounded-3xl p-3 ring-1 transition-colors', on ? 'bg-accent-soft ring-accent/50' : 'bg-surface-strong/70 ring-line')}>
      <button onClick={() => toggleTrack(track.id)} aria-pressed={on} className="flex w-full items-center gap-2.5 text-left">
        {vinyl ? (
          <img src="/img/vinyl.webp" alt="" className={cn('size-10 rounded-full shadow-md', on && status === 'playing' && 'spin-slow')} />
        ) : (
          <motion.span className="grid size-10 place-items-center rounded-2xl bg-surface-strong text-2xl" animate={on ? { rotate: [0, -6, 6, 0] } : {}} transition={{ duration: 2.4, repeat: on ? Infinity : 0 }}>
            {track.emoji}
          </motion.span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{track.label}</span>
          <span className="block truncate text-[11px] font-bold text-muted">{status === 'loading' ? 'Loading…' : status === 'error' ? 'Couldn’t play' : track.hint ?? (on ? 'Playing' : 'Tap to play')}</span>
        </span>
        <span className={cn('text-accent', !on && 'opacity-0')}>
          <Bars on={on && status === 'playing'} />
        </span>
      </button>
      {on && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-1">
          <Slider label={`${track.label} volume`} value={vol} onChange={(v) => setVolume(track.id, v)} />
        </motion.div>
      )}
      {status === 'loading' && <div className="skeleton absolute inset-x-0 bottom-0 h-0.5" />}
    </motion.div>
  );
}

export default function SoundsPanel() {
  const mixer = usePrefs((s) => s.mixer);
  const setPrefs = usePrefs((s) => s.set);
  const settings = useData((s) => s.data.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const [yt, setYt] = useState('');
  const [hasCustom, setHasCustom] = useState(hasCustomMusic());
  const fileRef = useRef<HTMLInputElement>(null);
  const anyOn = Object.values(mixer.on).some(Boolean);

  useEffect(() => {
    if (hasCustomMusic()) return;
    void get<Blob>('floww:music').then((b) => {
      if (b) {
        setCustomMusic(URL.createObjectURL(b));
        setHasCustom(true);
      }
    });
  }, []);

  const applyPreset = (mix: Record<string, number>) => {
    const on: Record<string, boolean> = {};
    const volumes = { ...mixer.volumes };
    for (const [k, v] of Object.entries(mix)) {
      on[k] = true;
      volumes[k] = v;
    }
    setPrefs({ mixer: { ...mixer, on, volumes } });
  };

  const groups: { id: Track['group']; label: string }[] = [
    { id: 'nature', label: 'Nature' },
    { id: 'cozy', label: 'Cozy' },
    { id: 'noise', label: 'Focus noise' },
    { id: 'music', label: 'Music' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-3xl bg-surface-strong/70 p-3 ring-1 ring-line">
        <button
          aria-label={anyOn ? 'Stop all sounds' : 'Muted'}
          onClick={() => setPrefs({ mixer: { ...mixer, on: {} } })}
          className={cn('pressable grid size-10 shrink-0 place-items-center rounded-2xl', anyOn ? 'bg-accent text-accent-ink' : 'bg-line text-muted')}
        >
          {anyOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <div className="flex-1">
          <p className="text-xs font-black tracking-wider text-muted uppercase">Master volume</p>
          <Slider label="Master volume" value={mixer.master} onChange={(v) => setPrefs({ mixer: { ...mixer, master: v } })} />
        </div>
      </div>

      <div>
        <SectionTitle>Quick mixes</SectionTitle>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {PRESETS.map((p) => (
            <motion.button
              key={p.name}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => applyPreset(p.mix)}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-surface-strong/70 px-3.5 py-2.5 text-sm font-extrabold ring-1 ring-line hover:ring-accent"
            >
              <span className="text-lg">{p.emoji}</span>
              {p.name}
            </motion.button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.id}>
          <SectionTitle>{g.label}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {TRACKS.filter((t) => t.group === g.id).map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
            {g.id === 'music' && hasCustom && <TrackCard track={customTrack()} />}
            {g.id === 'music' && (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2.5 rounded-3xl border-2 border-dashed border-line p-3 text-left text-sm font-extrabold text-muted hover:border-accent hover:text-ink"
              >
                <span className="grid size-10 place-items-center rounded-2xl bg-line">
                  <Upload size={18} />
                </span>
                {hasCustom ? 'Replace your music' : 'Upload your music'}
              </button>
            )}
          </div>
        </div>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 60 * 1024 * 1024) return toast({ emoji: '📦', title: 'That file is a bit big', body: 'Try something under 60MB.' });
          await set('floww:music', f);
          setCustomMusic(URL.createObjectURL(f));
          setHasCustom(true);
          usePrefs.getState().toggleTrack('custom', true);
          toast({ emoji: '🎵', title: 'Your music is ready', body: f.name });
        }}
      />
      {hasCustom && (
        <button
          className="-mt-4 text-xs font-extrabold text-muted hover:text-bad"
          onClick={async () => {
            usePrefs.getState().toggleTrack('custom', false);
            await del('floww:music');
            setCustomMusic(null);
            setHasCustom(false);
          }}
        >
          Remove uploaded music
        </button>
      )}

      <div>
        <SectionTitle>Play from YouTube</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = youtubeId(yt);
            if (!id) return toast({ emoji: '🤔', title: 'That link didn’t look like YouTube' });
            setPrefs({ musicVideo: { ...usePrefs.getState().musicVideo, id, open: true } });
            setYt('');
          }}
        >
          <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-line px-3">
            <Youtube size={18} className="text-[#ff0033]" />
            <input value={yt} onChange={(e) => setYt(e.target.value)} placeholder="Paste a YouTube link (lofi, podcasts…)" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-faint" />
          </div>
          <Button variant="primary" type="submit">
            Play
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            ['jfKfPfyJRdk', '📚 lofi hip hop'],
            ['4xDzrJKXOOY', '🌆 synthwave'],
            ['HuFYqnbVbzY', '🎹 jazz piano'],
          ].map(([id, l]) => (
            <button key={id} onClick={() => setPrefs({ musicVideo: { ...usePrefs.getState().musicVideo, id, open: true } })} className="rounded-full bg-line px-3 py-1 text-xs font-extrabold hover:bg-accent-soft">
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Session sounds</SectionTitle>
        <Segmented
          className="w-full"
          value={settings.soundProfile}
          onChange={(v) => {
            updateSettings({ soundProfile: v });
            if (v !== 'off') previewPack(v);
          }}
          options={[
            { value: 'chimes', label: '🔔 Cute chimes' },
            { value: 'indian', label: '😂 Meme mode' },
            { value: 'off', label: '🔕 Off' },
          ]}
        />
        <p className="text-xs font-semibold text-muted">Meme mode plays a random meme when you finish (and a sad one if you quit early). It’s the YouFloww classic.</p>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
          <span>
            <span className="block text-sm font-extrabold">Ambience only while focusing</span>
            <span className="block text-xs font-semibold text-muted">Sounds fade out on breaks and pauses</span>
          </span>
          <Switch checked={!!settings.ambienceOnlyWhileFocusing} onChange={(v) => updateSettings({ ambienceOnlyWhileFocusing: v })} />
        </label>
      </div>
    </div>
  );
}
