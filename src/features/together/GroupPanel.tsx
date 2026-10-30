/** The Study Together session view inside the hall: create / join, the shared plant + timer, members and the group chat. */
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Check, ChevronDown, Copy, Link2, LogOut, Play, Share2, Sprout } from 'lucide-react';
import { PlantView, PLANT_INFO, PLANT_READY, PLANT_SPECIES, type PlantSpeciesId } from '../garden/PlantView';
import { toast } from '@/store/ui';
import { cn } from '@/lib/utils';
import { formatClock } from '@/lib/time';
import { cleanCode } from './rt';
import { useGroupSession } from './useGroup';
import { GroupChat, LeaveButton, MemberList } from './ui';

const INK = 'text-[#3b2a20]';
const PAPER = 'bg-[#fffaf1] border-2 border-[#5b3f2c]/70 shadow-[0_30px_80px_-30px_rgb(60_30_10/0.6)]';
const BTN = 'pressable inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold disabled:opacity-40';
const DARK = cn(BTN, 'h-11 bg-[#3b2a20] px-5 text-[#fff6ea] hover:bg-[#4a3529]');
const LIGHT = cn(BTN, 'h-10 border-2 border-[#5b3f2c]/60 bg-[#fffaf1] px-3 text-sm text-[#3b2a20] hover:bg-[#fff1e0]');

const DURS = [15, 25, 45, 60, 90];

export function GroupPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useGroupSession();
  const uid = s.uid;
  const canWrite = s.phase !== 'joining';
  const [plant, setPlant] = useState<PlantSpeciesId>('sunflower');
  const [dur, setDur] = useState(25);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const g = s.group;
  const link = g ? `${location.origin}/?together=${g.code}` : '';
  const isHost = !!g && g.host === uid;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ emoji: '📋', title: 'Copy failed', body: text });
    }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Focus together on YouFloww', text: `Join my focus group on YouFloww! Code ${g!.code}`, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    void copy(link);
  };

  let body;
  if (s.phase === 'none' || s.phase === 'joining' || s.phase === 'closed') {
    body = (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-3xl">🌱</p>
          <h3 className="font-display text-2xl font-semibold">Study Together</h3>
          <p className="text-sm font-bold opacity-70">A small group with its own chat and one shared plant. It grows while everyone stays focused.</p>
        </div>
        {s.phase === 'closed' && <p className="rounded-xl bg-[#ffe9c7] px-3 py-2 text-center text-sm font-bold">The host closed this lobby. You can start your own or join another.</p>}
        {s.error && <p className="rounded-xl bg-[#f6d8d4] px-3 py-2 text-center text-sm font-bold">{s.error}</p>}
        <div>
          <p className="mb-1.5 text-xs font-extrabold tracking-wide uppercase opacity-60">Your plant</p>
          <div className="flex flex-wrap gap-1.5">
            {PLANT_SPECIES.filter((p) => PLANT_READY[p]).map((p) => (
              <button key={p} onClick={() => setPlant(p)} aria-pressed={plant === p} className={cn('pressable rounded-full px-3 py-1.5 text-sm font-extrabold', plant === p ? 'bg-[#3b2a20] text-[#fff6ea]' : 'bg-[#fff1e0] hover:bg-[#ffe6d2]')}>
                {PLANT_INFO[p].emoji} {PLANT_INFO[p].name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-extrabold tracking-wide uppercase opacity-60">How long</p>
          <div className="flex flex-wrap gap-1.5">
            {DURS.map((d) => (
              <button key={d} onClick={() => setDur(d)} aria-pressed={dur === d} className={cn('pressable rounded-full px-3 py-1.5 text-sm font-extrabold', dur === d ? 'bg-[#3b2a20] text-[#fff6ea]' : 'bg-[#fff1e0] hover:bg-[#ffe6d2]')}>
                {d} min
              </button>
            ))}
          </div>
        </div>
        <button className={cn(DARK, 'w-full')} disabled={!canWrite || s.phase === 'joining'} onClick={() => void s.create(plant, dur)}>
          <Sprout size={18} /> Create a group
        </button>
        <div className="flex items-center gap-2 text-xs font-extrabold opacity-50">
          <span className="h-px flex-1 bg-current" /> or join friends <span className="h-px flex-1 bg-current" />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 5) void s.join(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="ABCDE"
            aria-label="Group code"
            maxLength={5}
            autoCapitalize="characters"
            className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-[#5b3f2c]/40 bg-white px-4 text-center font-display text-xl font-semibold tracking-[0.35em] uppercase outline-none focus:border-[#e07a5f]"
          />
          <button type="submit" className={DARK} disabled={code.length !== 5 || !canWrite}>
            Join
          </button>
        </form>
      </div>
    );
  } else if (g) {
    const running = s.phase === 'running';
    const done = s.phase === 'bloom' || s.phase === 'rest';
    const awayN = s.away[0];
    const outN = s.out[0];
    let note = '';
    if (running && outN) note = `${outN.n} ended early, so the plant is resting. Nobody is in trouble. 💛`;
    else if (running && awayN) note = `${awayN.n} stepped away. The plant is drooping a little and will perk up when they are back.`;
    else if (running) note = 'Everyone is here. Keep going, it is growing! 🌿';
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="flex shrink-0 items-center justify-between gap-2 pr-9">
          <div>
            <p className="text-xs font-extrabold tracking-wide uppercase opacity-60">Group code</p>
            <p className="font-display text-3xl font-semibold tracking-[0.25em]">{g.code}</p>
          </div>
          {s.phase === 'lobby' && (
            <div className="flex gap-1.5">
              <button className={LIGHT} onClick={() => void copy(g.code)} aria-label="Copy code">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button className={LIGHT} onClick={() => void share()}>
                {typeof navigator.share === 'function' ? <Share2 size={16} /> : <Link2 size={16} />} Invite
              </button>
            </div>
          )}
        </div>

        <div className="relative flex flex-col items-center rounded-3xl bg-gradient-to-b from-[#fff1e0] to-[#ffe0c8] pt-2 pb-1.5 shrink-0">
          <PlantView species={g.plant} growth={s.growth} wilt={s.wilt} size={running || done ? 120 : 104} />
          <p className="font-display text-2xl font-semibold tabular-nums">{s.phase === 'lobby' ? `${g.dur}:00` : done ? '🎉' : formatClock(s.remaining)}</p>
          {done && (
            <motion.div initial={{ scale: 0.4, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="absolute top-2 right-2 grid size-20 place-items-center rounded-full border-[3px] border-dashed border-[#c95d44] bg-[#fff6ea]/90 text-center font-display text-[11px] leading-tight font-bold text-[#c95d44]">
              {s.phase === 'bloom' ? (
                <span>
                  TEAM
                  <br />
                  BLOOM
                  <br />
                  🌸
                </span>
              ) : (
                <span>
                  RESTED
                  <br />
                  🌿
                </span>
              )}
            </motion.div>
          )}
        </div>

        {done && (
          <p className="shrink-0 rounded-xl bg-[#dcebd0] px-3 py-1.5 text-center text-[13px] font-extrabold text-[#3f5a2d]">
            {s.phase === 'bloom' ? (s.me?.m !== 'out' ? `You bloomed together! +${s.bonus} 🐟 for everyone who stayed.` : 'The group bloomed. Thank you for helping it grow 🌸') : 'The plant rests this time. You still showed up, and that counts. 💛'}
          </p>
        )}
        {note && <p className={cn('shrink-0 rounded-xl px-3 py-1.5 text-center text-[13px] font-bold', outN ? 'bg-[#f6d8d4]' : awayN ? 'bg-[#ffe9c7]' : 'bg-[#eef5e6]')}>{note}</p>}

        <div className="max-h-24 shrink-0 overflow-y-auto">
          <MemberList tone="paper" running={running} />
        </div>
        <GroupChat tone="paper" className="min-h-[180px] flex-1" />

        {s.phase === 'lobby' &&
          (isHost ? (
            <button className={cn(DARK, 'w-full shrink-0')} onClick={() => void s.start()}>
              <Play size={18} /> Start together ({g.members.length})
            </button>
          ) : (
            <p className="shrink-0 text-center text-sm font-bold opacity-70">Waiting for the host to start… 🍵</p>
          ))}
        {s.error && <p className="text-center text-sm font-bold text-[#a8442f]">{s.error}</p>}
        <LeaveButton className={cn(LIGHT, 'w-full shrink-0')} onLeave={() => void s.leave()} label={<><LogOut size={15} /> {done ? 'Leave group' : running ? 'Leave group (the plant will rest)' : 'Leave group'}</>} />
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Study Together"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className={cn(
            'absolute inset-x-0 bottom-0 z-30 flex max-h-[86dvh] flex-col overflow-y-auto rounded-t-[28px] p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:inset-x-auto sm:top-[72px] sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[380px] sm:rounded-[28px]',
            g ? 'h-[86dvh] sm:h-auto' : '',
            PAPER,
            INK,
          )}
        >
          <button onClick={onClose} aria-label="Minimise" className="pressable absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-[#fff1e0]">
            <ChevronDown size={18} />
          </button>
          {body}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
