import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Download, Minus, Plus, Upload } from 'lucide-react';
import { useData } from '@/store/data';
import { toast, useUI } from '@/store/ui';
import { normalizeUserData, defaultUserData } from '@/data/model';
import type { Settings } from '@/data/types';
import { requestNotifications } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { Button, SectionTitle, Switch } from '@/ui/primitives';
import { Kbd } from '@/ui/primitives';

const PRESETS = [
  { name: 'Classic', emoji: '🍅', w: 25, s: 5, l: 15 },
  { name: 'Deep', emoji: '🌊', w: 50, s: 10, l: 20 },
  { name: 'Sprint', emoji: '⚡', w: 15, s: 3, l: 10 },
  { name: 'Ultra', emoji: '🧠', w: 90, s: 20, l: 30 },
];

function Stepper({ label, value, onChange, min, max, step = 1, unit = 'min' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const btn = 'pressable grid size-9 place-items-center rounded-xl bg-line hover:bg-accent-soft disabled:opacity-30';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-2.5 pl-3.5 ring-1 ring-line">
      <span className="text-sm font-extrabold">{label}</span>
      <div className="flex items-center gap-1.5">
        <button className={btn} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Minus size={15} strokeWidth={3} />
        </button>
        <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display tabular w-16 text-center text-lg font-semibold">
          {value}
          <span className="ml-0.5 text-xs text-muted">{unit}</span>
        </motion.span>
        <button className={btn} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Plus size={15} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
      <span className="min-w-0">
        <span className="block text-sm font-extrabold">{title}</span>
        {sub && <span className="block text-xs font-semibold text-muted">{sub}</span>}
      </span>
      {children}
    </label>
  );
}

export default function SettingsPanel() {
  const s = useData((x) => x.data.settings);
  const update = useData((x) => x.updateSettings);
  const replace = useData((x) => x.replace);
  const setUI = useUI((x) => x.set);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const w = Math.round(s.workDuration / 60), sb = Math.round(s.shortBreakDuration / 60), lb = Math.round(s.longBreakDuration / 60);
  const set = (p: Partial<Settings>) => update(p);

  return (
    <div className="space-y-7">
      <section className="space-y-2">
        <SectionTitle>Timer</SectionTitle>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => {
            const on = p.w === w && p.s === sb && p.l === lb;
            return (
              <motion.button
                key={p.name}
                whileTap={{ scale: 0.92 }}
                onClick={() => set({ workDuration: p.w * 60, shortBreakDuration: p.s * 60, longBreakDuration: p.l * 60 })}
                className={cn('rounded-2xl py-2.5 text-center ring-1 transition-colors', on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-strong/70 ring-line')}
              >
                <div className="text-xl">{p.emoji}</div>
                <div className="text-xs font-black">{p.name}</div>
                <div className="text-[10px] font-bold text-muted">
                  {p.w}/{p.s}/{p.l}
                </div>
              </motion.button>
            );
          })}
        </div>
        <Stepper label="🎯 Focus" value={w} min={1} max={240} step={w >= 30 ? 5 : 1} onChange={(v) => set({ workDuration: v * 60 })} />
        <Stepper label="☕ Short break" value={sb} min={1} max={60} onChange={(v) => set({ shortBreakDuration: v * 60 })} />
        <Stepper label="🌿 Long break" value={lb} min={1} max={90} step={lb >= 20 ? 5 : 1} onChange={(v) => set({ longBreakDuration: v * 60 })} />
        <Stepper label="🔁 Long break every" value={s.longBreakInterval ?? 4} min={2} max={10} unit="×" onChange={(v) => set({ longBreakInterval: v })} />
        <Stepper label="🏆 Daily goal" value={Math.round((s.dailyGoalMinutes ?? 120) / 60 * 2) / 2} min={0.5} max={14} step={0.5} unit="h" onChange={(v) => set({ dailyGoalMinutes: Math.round(v * 60) })} />
        <Row title="Auto-start breaks" sub="Roll straight into your break">
          <Switch checked={!!s.autoStartBreaks} onChange={(v) => set({ autoStartBreaks: v })} />
        </Row>
        <Row title="Auto-start focus" sub="Begin the next round after a break">
          <Switch checked={!!s.autoStartFocus} onChange={(v) => set({ autoStartFocus: v })} />
        </Row>
      </section>

      <section className="space-y-2">
        <SectionTitle>Helpers</SectionTitle>
        <Row title="Notifications" sub="A ping when sessions end (tab in background)">
          <Switch
            checked={!!s.notifications}
            onChange={async (v) => {
              if (v && !(await requestNotifications())) return toast({ emoji: '🔕', title: 'Notifications are blocked', body: 'Enable them in your browser settings.' });
              set({ notifications: v });
            }}
          />
        </Row>
        <Row title="Keep screen awake" sub="While a session is running">
          <Switch checked={!!s.keepAwake} onChange={(v) => set({ keepAwake: v })} />
        </Row>
        <Row title="Soft ticking" sub="A tiny tick each second while focusing">
          <Switch checked={!!s.tickSound} onChange={(v) => set({ tickSound: v })} />
        </Row>
        <Row title="24-hour clock" sub="In the planner">
          <Switch checked={!!s.use24h} onChange={(v) => set({ use24h: v })} />
        </Row>
        <Row title="👀 Presence guard (beta)" sub="Uses your camera on-device to auto-pause when you walk away. Nothing is uploaded.">
          <Switch checked={!!s.isAccountabilityOn} onChange={(v) => set({ isAccountabilityOn: v })} />
        </Row>
      </section>

      <section className="space-y-2">
        <SectionTitle>Keyboard</SectionTitle>
        <button onClick={() => setUI({ help: true })} className="flex w-full items-center justify-between rounded-2xl bg-surface-strong/70 p-3 text-sm font-extrabold ring-1 ring-line hover:ring-accent">
          See all shortcuts <Kbd>?</Kbd>
        </button>
      </section>

      <section className="space-y-2">
        <SectionTitle>Your data</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button
            icon={<Download size={16} />}
            onClick={() => {
              const blob = new Blob([JSON.stringify(useData.getState().data, null, 2)], { type: 'application/json' });
              const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `youfloww-backup-${new Date().toISOString().slice(0, 10)}.json` });
              a.click();
            }}
          >
            Export
          </Button>
          <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const data = normalizeUserData(JSON.parse(await f.text()));
              replace(data);
              toast({ emoji: '📦', title: 'Backup restored' });
            } catch {
              toast({ emoji: '⚠️', title: 'That file couldn’t be read' });
            }
          }}
        />
        {confirm ? (
          <div className="rounded-2xl bg-bad/10 p-3">
            <p className="mb-2 text-sm font-extrabold text-bad">This wipes your stats, tasks, journal and planner. Sure?</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  const fresh = defaultUserData();
                  fresh.profileName = useData.getState().data.profileName;
                  replace(normalizeUserData(fresh));
                  setConfirm(false);
                  toast({ emoji: '🧹', title: 'Fresh start!' });
                }}
              >
                Yes, reset everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
            Reset all data
          </Button>
        )}
      </section>
      <p className="pb-2 text-center text-xs font-bold text-faint">YouFloww v3 · made with 💛 for deep focus</p>
    </div>
  );
}
