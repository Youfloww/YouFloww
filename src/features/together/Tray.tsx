/**
 * The Study Hall / Study Together tray: a small glass pill that stays on Home and over other worlds while a hall
 * seat or a group is live in this tab (the session store keeps the connection; this is only a view of it).
 * Collapsed = who is here + unread badge. Expanded = people, messages, chat, "Open hall", "Leave".
 * Loaded lazily by LayerHost only while `useTogetherLive.on`.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, DoorOpen, Maximize2, X } from 'lucide-react';
import { useUI } from '@/store/ui';
import { cn } from '@/lib/utils';
import { formatClock } from '@/lib/time';
import { groupView, leaveGroup, leaveHall, openAsks, openView, people, profile, restore, startGroup, unreadChat, unseenHall, useSession } from './session';
import { useServerNow } from './useGroup';
import { BTN, Face, GroupChat, HallInbox, HallPeople, LeaveButton, MemberList, PersonMenu, TONE } from './ui';
import type { Seat } from './rt';

const t = TONE.glass;

export default function Tray() {
  const mode = useUI((s) => s.mode);
  const s = useSession();
  const now = useServerNow(1000);
  const [pick, setPick] = useState<Seat | null>(null);
  const [peek, setPeek] = useState<{ id: string; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => void restore(), []);

  const inHall = s.hall !== 'off';
  const g = groupView(s, now);
  const hasGroup = !!s.code;
  const asks = openAsks(s, now).length;
  const chatN = unreadChat(s);
  const hallN = unseenHall(s);
  const badge = asks + chatN + hallN;
  const here = inHall ? people(s, now).length : 0;
  const tab = !hasGroup ? 'hall' : !inHall ? 'group' : s.trayTab;
  const open = s.tray;
  const hidden = mode === 'together';
  const set = useSession.setState;

  // a new "study together?" ask opens the tray (it needs an answer within 2 minutes)
  const lastAsks = useRef(asks);
  useEffect(() => {
    if (asks > lastAsks.current && !hidden) set({ tray: true, trayTab: 'hall' });
    lastAsks.current = asks;
  }, [asks, hidden, set]);

  // a short peek of the newest unread chat message while collapsed
  const lastMsg = s.group?.chat.at(-1);
  useEffect(() => {
    if (!lastMsg || open || hidden || lastMsg.uid === s.uid || lastMsg.t <= s.readAt) return;
    setPeek({ id: lastMsg.id, text: `${lastMsg.n}: ${lastMsg.x}` });
    const id = setTimeout(() => setPeek(null), 5000);
    return () => clearTimeout(id);
  }, [lastMsg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape / a tap outside folds the tray
  useEffect(() => {
    if (!open || hidden) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (pick) setPick(null);
      else set({ tray: false });
    };
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-toast]')) set({ tray: false });
    };
    window.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down);
    return () => {
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', down);
    };
  }, [open, hidden, pick, set]);

  // the person menu closes when they leave the hall
  useEffect(() => {
    if (pick && !s.seats.some((x) => x.uid === pick.uid)) setPick(null);
  }, [s.seats, pick]);

  if (hidden) return null;

  const me = profile();
  const connecting = s.conn === 'connecting' || s.hall === 'joining' || s.groupBusy;
  const groupChip =
    g.phase === 'running' ? `🌱 ${formatClock(g.remaining)}` : g.phase === 'bloom' ? '🌸 bloomed' : g.phase === 'rest' ? '🌿 rested' : hasGroup ? `🌱 ${s.code}` : '';
  const label = connecting && !here && !s.group ? 'Reconnecting…' : inHall ? `${here} here` : 'Study Together';
  const pickSeat = pick ? (s.seats.find((x) => x.uid === pick.uid) ?? pick) : null;

  return (
    <div ref={box} className={cn('pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top,0px)+58px)] flex flex-col items-end gap-2 sm:right-4 sm:top-16', mode ? 'z-[46]' : 'z-[35]')}>
      <button
        type="button"
        onClick={() => set({ tray: !open })}
        aria-expanded={open}
        aria-label={`Study Hall: ${label}${groupChip ? `, group ${groupChip}` : ''}${badge ? `, ${badge} new` : ''}. ${open ? 'Fold' : 'Open'} the tray`}
        className="glass-strong pressable pointer-events-auto relative flex h-10 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)]"
      >
        <span className="relative">
          <Face a={me.animal} size={32} />
          <span className={cn('absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[var(--color-bg,#fff)]', connecting ? 'animate-pulse bg-[#e6a640]' : 'bg-[#6fae5a]')} />
        </span>
        <span className="text-[13px] font-extrabold whitespace-nowrap">{label}</span>
        {groupChip && inHall && <span className="text-[12px] font-extrabold whitespace-nowrap tabular-nums max-[379px]:hidden">· {groupChip}</span>}
        {groupChip && !inHall && <span className="text-[12px] font-extrabold whitespace-nowrap tabular-nums">{groupChip}</span>}
        {badge > 0 && (
          <motion.span key={badge} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#e07a5f] px-1 text-[11px] font-extrabold text-white shadow">
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {peek && !open && (
          <motion.button
            key={peek.id}
            type="button"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            onClick={() => set({ tray: true, trayTab: 'group' })}
            className="glass-strong pointer-events-auto max-w-[min(280px,calc(100vw-24px))] truncate rounded-2xl rounded-tr-md px-3 py-1.5 text-left text-[12.5px] font-bold text-ink shadow-lg"
          >
            💬 {peek.text}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Study Hall tray"
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ transformOrigin: 'top right' }}
            className={cn('pointer-events-auto flex max-h-[min(560px,calc(100dvh-150px))] w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] p-3', t.card)}
          >
            <header className="mb-2 flex items-center gap-1.5">
              {pickSeat ? (
                <button onClick={() => setPick(null)} className={cn(BTN, 'h-8 px-2 text-xs', t.ghost)}>
                  <ChevronLeft size={14} /> Back
                </button>
              ) : hasGroup && inHall ? (
                <div className="flex rounded-full bg-surface p-0.5 ring-1 ring-line" role="tablist">
                  {(['hall', 'group'] as const).map((k) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => set({ trayTab: k })}
                      className={cn('pressable relative rounded-full px-3 py-1 text-xs font-extrabold', tab === k ? 'bg-accent text-accent-ink' : 'text-muted')}
                    >
                      {k === 'hall' ? `Hall · ${here}` : 'Group'}
                      {(k === 'hall' ? asks + hallN : chatN) > 0 && tab !== k && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-[#e07a5f]" />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="font-display text-base font-semibold">{tab === 'hall' ? `Study Hall ${s.room ? s.room.slice(1) : ''}` : 'Study Together'}</p>
              )}
              <button onClick={() => set({ tray: false })} aria-label="Fold the tray" className="pressable ml-auto grid size-8 place-items-center rounded-full text-muted hover:bg-accent-soft">
                <X size={16} />
              </button>
            </header>

            {pickSeat ? (
              <div className="min-h-0 overflow-y-auto overscroll-contain pr-0.5">
                <PersonMenu seat={pickSeat} tone="glass" onDone={() => setPick(null)} />
              </div>
            ) : tab === 'hall' ? (
              <>
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
                  {s.err && s.hall === 'off' && <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold ring-1 ring-line">{s.err.msg}</p>}
                  <HallInbox tone="glass" max={4} empty={false} />
                  {inHall ? (
                    <HallPeople tone="glass" onPick={setPick} />
                  ) : (
                    <p className="py-3 text-center text-sm font-bold text-muted">{connecting ? 'Finding your seat again…' : 'You are not seated right now.'}</p>
                  )}
                </div>
                <footer className="mt-2.5 flex gap-1.5">
                  <button onClick={() => openView('hall')} className={cn(BTN, 'h-10 flex-1 text-sm', t.btn)}>
                    <Maximize2 size={15} /> Open hall
                  </button>
                  {inHall && <LeaveButton onLeave={() => void leaveHall()} label={<><DoorOpen size={15} /> Leave hall</>} className={cn(BTN, 'h-10 px-3 text-sm', t.ghost)} />}
                </footer>
              </>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <GroupStatus phase={g.phase} remaining={g.remaining} host={s.group?.host === s.uid} code={s.code} n={s.group?.members.length ?? 0} />
                  <div className="max-h-[92px] overflow-y-auto">
                    <MemberList tone="glass" running={g.phase === 'running'} />
                  </div>
                  {s.group && <GroupChat tone="glass" className="h-[min(240px,34dvh)]" />}
                </div>
                <footer className="mt-2.5 flex gap-1.5">
                  <button onClick={() => openView('group')} className={cn(BTN, 'h-10 flex-1 text-sm', t.btn)}>
                    <Maximize2 size={15} /> Open session
                  </button>
                  <LeaveButton onLeave={() => void leaveGroup()} label="Leave group" className={cn(BTN, 'h-10 px-3 text-sm', t.ghost)} />
                </footer>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupStatus({ phase, remaining, host, code, n }: { phase: string; remaining: number; host: boolean; code: string; n: number }) {
  let text = '';
  if (phase === 'joining') text = 'Joining the group…';
  else if (phase === 'lobby') text = host ? `Group ${code} · ${n} in the lobby` : `Group ${code} · waiting for the host`;
  else if (phase === 'running') text = `Focusing together · ${formatClock(remaining)} left`;
  else if (phase === 'bloom') text = 'Team bloom! 🌸';
  else if (phase === 'rest') text = 'The plant is resting 🌿';
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1.5 ring-1 ring-line">
      <span className="text-lg">🌱</span>
      <p className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold tabular-nums">{text}</p>
      {phase === 'lobby' && host && (
        <button onClick={() => void startGroup()} className={cn(BTN, 'h-7 px-2.5 text-xs', t.btn)}>
          Start
        </button>
      )}
    </div>
  );
}
