/** Small shared pieces of the hall view and the tray: person menu, "study together?" card, group chat, rows. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BellOff, Bell, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { animalImg, animalOf, KUDOS, type KudosKind } from './animals';
import { ASK_TTL, CHAT_MAX, SAYS, SAY_KINDS, isMuted, mask } from './presets';
import { answerAsk, askTogether, cooldowns, people, sendChat, sendKudos, sendSay, toggleMute, useSession, type Item } from './session';
import { useServerNow, useViewing } from './useGroup';
import type { Member, Seat } from './rt';

export type Tone = 'paper' | 'glass';
export const TONE = {
  paper: {
    card: 'bg-[#fffaf1] border-2 border-[#5b3f2c]/70 text-[#3b2a20] shadow-[0_30px_80px_-30px_rgb(60_30_10/0.6)]',
    soft: 'bg-[#fff1e0]',
    hover: 'hover:bg-[#ffe6d2]',
    btn: 'bg-[#3b2a20] text-[#fff6ea] hover:bg-[#4a3529]',
    ghost: 'border-2 border-[#5b3f2c]/50 bg-[#fffaf1] text-[#3b2a20] hover:bg-[#fff1e0]',
    muted: 'opacity-65',
    input: 'bg-white border-2 border-[#5b3f2c]/30 focus:border-[#e07a5f]',
    mine: 'bg-[#3b2a20] text-[#fff6ea]',
    theirs: 'bg-[#fff1e0] text-[#3b2a20]',
    line: 'border-[#5b3f2c]/15',
  },
  glass: {
    card: 'glass-strong text-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]',
    soft: 'bg-surface',
    hover: 'hover:bg-accent-soft',
    btn: 'bg-accent text-accent-ink hover:brightness-105',
    ghost: 'bg-surface text-ink ring-1 ring-line hover:bg-accent-soft',
    muted: 'text-muted',
    input: 'bg-surface ring-1 ring-line focus:ring-2 focus:ring-accent',
    mine: 'bg-accent text-accent-ink',
    theirs: 'bg-surface text-ink ring-1 ring-line',
    line: 'border-line',
  },
} as const;
export const BTN = 'pressable inline-flex items-center justify-center gap-1.5 rounded-2xl font-extrabold disabled:opacity-40 disabled:pointer-events-none';

export const STATUS = { f: 'focusing', b: 'on a break', p: 'paused', i: 'relaxing' } as const;
export const RING = { f: '#e07a5f', b: '#7fa66a', p: '#b9a89a', i: 'transparent' } as const;
export function seatLine(s: Seat, now: number) {
  if (s.s === 'f' || s.s === 'b') return `${STATUS[s.s]} · ${Math.max(1, Math.ceil((s.e - now) / 60000))}m left`;
  return STATUS[s.s];
}
export const memberLine = (m: Member, running: boolean) =>
  m.m === 'away' ? 'stepped away' : m.m === 'left' ? 'reconnecting…' : m.m === 'out' ? 'ended early' : running ? 'focusing' : 'here';
export const memberDot = (m: Member) => (m.m === 'in' ? 'bg-[#6fae5a]' : m.m === 'out' ? 'bg-[#d0705f]' : 'bg-[#e6a640]');
const secs = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

export function Face({ a, size = 36, className }: { a: number; size?: number; className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full', className)} style={{ width: size, height: size, background: `radial-gradient(circle at 50% 35%, #fffaf1, ${animalOf(a).tint})` }}>
      <img src={animalImg(a)} alt="" draggable={false} decoding="async" className="size-[86%] object-contain" />
    </span>
  );
}

/** A two-step "Leave" button, so a stray tap never ends anything. */
export function LeaveButton({ label, onLeave, className }: { label: ReactNode; onLeave: () => void; className?: string }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const id = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(id);
  }, [sure]);
  return (
    <button type="button" className={cn(className, sure && '!bg-[#c95d44] !text-white')} onClick={() => (sure ? onLeave() : setSure(true))}>
      {sure ? 'Tap again to leave' : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Person menu: presets, "study together?", kudos, mute                */
/* ------------------------------------------------------------------ */
export function PersonMenu({ seat, tone, onDone }: { seat: Seat; tone: Tone; onDone: () => void }) {
  const t = TONE[tone];
  const now = useServerNow(1000);
  const s = useSession();
  const cd = cooldowns(s, seat.uid, now);
  const muted = isMuted(seat.uid);
  const inGroup = !!s.group?.members.some((m) => m.uid === seat.uid);
  const out = s.out[seat.uid];
  let askLabel = 'Study together? 📚';
  if (inGroup) askLabel = 'In your group 🌱';
  else if (cd.asking) askLabel = `Waiting for ${seat.n}… ${secs(out.t + ASK_TTL - now)}`;
  else if (out?.state === 'no') askLabel = 'They said not now 💛';
  else if (cd.ask > 0) askLabel = `Ask again in ${secs(cd.ask)}`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Face a={seat.a} size={52} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight font-semibold">{seat.n}</p>
          <p className={cn('truncate text-xs font-bold', t.muted)}>
            {seatLine(seat, now)}
            {seat.w ? ` · ${seat.w}` : ''}
          </p>
        </div>
      </div>
      <div>
        <p className={cn('mb-1.5 text-[11px] font-extrabold tracking-wide uppercase', t.muted)}>Say something {cd.say > 0 && `· ${secs(cd.say)}`}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SAY_KINDS.map((k) => (
            <button key={k} disabled={cd.say > 0} onClick={() => void sendSay(seat.uid, k).then((ok) => ok && onDone())} className={cn(BTN, 'h-10 px-2 text-[13px]', t.soft, t.hover)}>
              {SAYS[k].text}
            </button>
          ))}
        </div>
      </div>
      <button disabled={inGroup || cd.asking || cd.ask > 0} onClick={() => void askTogether(seat.uid)} className={cn(BTN, 'h-11 w-full text-sm', t.btn)}>
        {askLabel}
      </button>
      <div>
        <p className={cn('mb-1.5 text-[11px] font-extrabold tracking-wide uppercase', t.muted)}>Cheer {cd.kudos > 0 && `· again in ${secs(cd.kudos)}`}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(KUDOS) as KudosKind[]).map((k) => (
            <button key={k} disabled={cd.kudos > 0} onClick={() => void sendKudos(seat.uid, k).then((ok) => ok && onDone())} className={cn(BTN, 'flex-col gap-0 py-1.5 text-[11px]', t.soft, t.hover)} aria-label={KUDOS[k].label}>
              <span className="text-2xl leading-8">{KUDOS[k].emoji}</span>
              {KUDOS[k].label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => toggleMute(seat.uid)} className={cn('pressable mx-auto flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-extrabold', t.muted, 'hover:opacity-100')}>
        {muted ? <Bell size={13} /> : <BellOff size={13} />} {muted ? `Unmute ${seat.n}` : `Mute ${seat.n}`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* "Study together?" card                                              */
/* ------------------------------------------------------------------ */
export function AskCard({ item, tone, now, onClose }: { item: Item; tone: Tone; now: number; onClose?: () => void }) {
  const t = TONE[tone];
  const left = Math.max(0, item.t + ASK_TTL - now);
  const busy = item.done === 'busy';
  return (
    <div className={cn('relative overflow-hidden rounded-2xl p-3', tone === 'paper' ? 'bg-[#fff1e0]' : 'bg-surface ring-1 ring-line')} role="alert">
      <div className="flex items-center gap-2.5">
        <Face a={item.animal} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{item.name}</p>
          <p className="text-[13px] font-bold">{item.text}</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Hide" className={cn('pressable -mt-5 -mr-1 rounded-full px-1.5 text-lg leading-none', t.muted)}>
            ×
          </button>
        )}
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <button disabled={busy || !left} onClick={() => void answerAsk(item, true)} className={cn(BTN, 'h-9 flex-1 text-sm', t.btn)}>
          {busy ? 'Opening a group…' : 'Accept'}
        </button>
        <button disabled={busy || !left} onClick={() => void answerAsk(item, false)} className={cn(BTN, 'h-9 px-3 text-sm', t.ghost)}>
          Not now
        </button>
      </div>
      <span className="absolute bottom-0 left-0 h-[3px] bg-[#e07a5f] transition-[width] duration-1000 ease-linear" style={{ width: `${(left / ASK_TTL) * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Group chat                                                          */
/* ------------------------------------------------------------------ */
export function GroupChat({ tone, className }: { tone: Tone; className?: string }) {
  const t = TONE[tone];
  const group = useSession((s) => s.group);
  const uid = useSession((s) => s.uid);
  useSession((s) => s.muteTick);
  useViewing('chat');
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const list = (group?.chat ?? []).filter((m) => !isMuted(m.uid));
  const lastId = list.at(-1)?.id;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, list.length]);
  if (!group) return null;
  const send = async () => {
    if (!text.trim()) return;
    const r = await sendChat(text);
    if (r === 'ok') {
      setText('');
      setHint('');
    } else setHint(r === 'slow' ? 'A tiny pause between messages 🍵' : r === 'fail' ? 'Not sent. Try again in a moment.' : '');
  };
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={box} className="min-h-[72px] flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-0.5 py-1" aria-live="polite" aria-label="Group chat">
        {list.length === 0 && <p className={cn('py-3 text-center text-xs font-bold', t.muted)}>No messages yet. Say hi 👋</p>}
        {list.map((m, i) => {
          const mine = m.uid === uid;
          const head = !mine && list[i - 1]?.uid !== m.uid;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              {head && <span className={cn('px-2 text-[10.5px] font-extrabold', t.muted)}>{m.n}</span>}
              <span className={cn('max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug font-semibold break-words', mine ? cn(t.mine, 'rounded-br-md') : cn(t.theirs, 'rounded-bl-md'))}>{mask(m.x)}</span>
            </div>
          );
        })}
      </div>
      <form
        className="mt-1.5 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))}
          maxLength={CHAT_MAX}
          placeholder="Message your group…"
          aria-label="Message your group"
          enterKeyHint="send"
          className={cn('h-10 min-w-0 flex-1 rounded-xl px-3 text-sm font-semibold outline-none placeholder:opacity-50', t.input)}
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className={cn(BTN, 'size-10 shrink-0', t.btn)}>
          <Send size={16} />
        </button>
      </form>
      {(hint || text.length > CHAT_MAX - 40) && <p className={cn('mt-1 px-1 text-[11px] font-bold', t.muted)}>{hint || `${CHAT_MAX - text.length} characters left`}</p>}
    </div>
  );
}

export function MemberList({ tone, running }: { tone: Tone; running: boolean }) {
  const t = TONE[tone];
  const group = useSession((s) => s.group);
  const uid = useSession((s) => s.uid);
  useSession((s) => s.muteTick);
  if (!group) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {group.members.map((m) => (
        <li key={m.uid} className={cn('flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5', t.soft)} title={memberLine(m, running)}>
          <span className="relative">
            <Face a={m.a} size={26} />
            <span className={cn('absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white', memberDot(m))} />
          </span>
          <span className="max-w-[90px] truncate text-xs font-extrabold">
            {m.n}
            {m.uid === uid && ' (you)'}
            {m.uid === group.host && ' 👑'}
          </span>
          {m.uid !== uid && (
            <button onClick={() => toggleMute(m.uid)} aria-label={isMuted(m.uid) ? `Unmute ${m.n}` : `Mute ${m.n}`} className={cn('pressable -mr-1 rounded-full p-0.5', t.muted)}>
              {isMuted(m.uid) ? <Bell size={11} /> : <BellOff size={11} />}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Hall inbox: open "study together?" asks + the latest says / cheers  */
/* ------------------------------------------------------------------ */
export function HallInbox({ tone, max = 6, empty = true, withAsks = true }: { tone: Tone; max?: number; empty?: boolean; withAsks?: boolean }) {
  const t = TONE[tone];
  const items = useSession((s) => s.items);
  useSession((s) => s.muteTick);
  const now = useServerNow(1000);
  useViewing('hall');
  const asks = withAsks ? openAskItems(items, now) : [];
  const rest = items.filter((i) => i.kind !== 'ask' && !isMuted(i.from)).slice(0, max);
  if (!asks.length && !rest.length)
    return empty ? <p className={cn('py-2 text-center text-xs font-bold', t.muted)}>Nothing new. Tap someone to say hi 👋</p> : null;
  return (
    <div className="space-y-1.5">
      {asks.map((i) => (
        <AskCard key={i.id} item={i} tone={tone} now={now} />
      ))}
      {rest.length > 0 && (
        <ul className="space-y-1">
          {rest.map((i) => (
            <li key={i.id} className={cn('flex items-center gap-2 rounded-xl px-1.5 py-1', t.soft)}>
              <Face a={i.animal} size={26} />
              <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                <span className="font-extrabold">{i.name}</span> {i.kind === 'say' ? `: ${i.text}` : i.text}
              </p>
              <span className={cn('shrink-0 text-[10.5px] font-bold', t.muted)}>{ago(now - i.t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/** asks still waiting for my answer (or being answered right now) */
export const openAskItems = (items: Item[], now: number) => items.filter((i) => i.kind === 'ask' && !isMuted(i.from) && (i.done === 'busy' || (!i.done && i.t + ASK_TTL > now)));
const ago = (ms: number) => (ms < 60_000 ? 'now' : ms < 3_600_000 ? `${Math.floor(ms / 60_000)}m` : `${Math.floor(ms / 3_600_000)}h`);

/** People in my hall (me first), each opens the person menu. */
export function HallPeople({ tone, onPick, className }: { tone: Tone; onPick: (s: Seat) => void; className?: string }) {
  const t = TONE[tone];
  const s = useSession();
  const now = useServerNow(5000);
  const list = people(s, now).sort((a, b) => (a.uid === s.uid ? -1 : b.uid === s.uid ? 1 : a.i - b.i));
  const group = new Set(s.group?.members.map((m) => m.uid) ?? []);
  return (
    <ul className={cn('space-y-1', className)} aria-label="People in your hall">
      {list.map((p) => {
        const me = p.uid === s.uid;
        return (
          <li key={p.uid}>
            <button
              type="button"
              disabled={me}
              onClick={() => onPick(p)}
              className={cn('pressable flex w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left disabled:cursor-default', !me && t.hover)}
              aria-label={me ? `You, ${seatLine(p, now)}` : `${p.n}, ${seatLine(p, now)}. Say something`}
            >
              <span className="relative">
                <Face a={p.a} size={30} />
                {p.s !== 'i' && <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white" style={{ background: RING[p.s] }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-extrabold">
                  {p.n}
                  {me && <span className={t.muted}> (you)</span>}
                  {group.has(p.uid) && !me && ' 🌱'}
                </span>
                <span className={cn('block truncate text-[11px] font-bold', t.muted)}>
                  {seatLine(p, now)}
                  {p.w ? ` · ${p.w}` : ''}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
