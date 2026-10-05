import type { UserData } from '@/data/types';
import { deriveStats } from '@/data/model';
import { keyToDate } from '@/lib/time';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  rarity: Rarity;
  /** 0..1 progress */
  progress: (d: UserData) => number;
}

const ratio = (v: number, goal: number) => Math.min(1, v / goal);
const hours = (d: UserData) => d.totalFocusSeconds / 3600;
const log = (d: UserData) => d.sessionLog ?? [];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_streak', name: 'Getting Started', desc: 'Finish your very first focus session', emoji: '🌱', rarity: 'common', progress: (d) => ratio(d.totalSessions, 1) },
  { id: 'hour_hero', name: 'Hour Hero', desc: '10 hours of total focus', emoji: '⏰', rarity: 'common', progress: (d) => ratio(hours(d), 10) },
  { id: 'speed_demon', name: 'On a Roll', desc: '5 focus sessions in a single day', emoji: '⚡', rarity: 'common', progress: (d) => ratio(d.todaySessions, 5) },
  { id: 'goal_getter', name: 'Goal Getter', desc: 'Hit your daily focus goal', emoji: '🎯', rarity: 'common', progress: (d) => deriveStats(d).goalProgress },
  { id: 'week_warrior', name: 'Week Warrior', desc: 'Keep a 7-day streak', emoji: '🔥', rarity: 'rare', progress: (d) => ratio(d.bestStreak, 7) },
  { id: 'early_bird', name: 'Early Bird', desc: 'Start a session before 7am', emoji: '🐦', rarity: 'rare', progress: (d) => (log(d).some((s) => new Date(s.at).getHours() < 7 && new Date(s.at).getHours() >= 4) ? 1 : 0) },
  { id: 'night_owl', name: 'Night Owl', desc: 'Focus after 11pm', emoji: '🦉', rarity: 'rare', progress: (d) => (log(d).some((s) => { const h = new Date(s.at).getHours(); return h >= 23 || h < 4; }) ? 1 : 0) },
  { id: 'marathon_runner', name: 'Marathoner', desc: 'One session of 90+ minutes', emoji: '🏃', rarity: 'rare', progress: (d) => ratio(d.longestSession, 90) },
  { id: 'weekend_warrior', name: 'Weekend Warrior', desc: 'Focus on both Saturday and Sunday', emoji: '🏖️', rarity: 'rare', progress: (d) => {
      const days = Object.entries(d.dailyFocusSeconds ?? {}).filter(([, v]) => v > 0).map(([k]) => keyToDate(k));
      const sats = new Set(days.filter((x) => x.getDay() === 6).map((x) => x.toDateString()));
      return days.some((x) => x.getDay() === 0 && sats.has(new Date(x.getTime() - 86400000).toDateString())) ? 1 : 0;
    } },
  { id: 'multitasker', name: 'Juggler', desc: 'Create 5 task categories', emoji: '🤹', rarity: 'rare', progress: (d) => ratio(d.regularTasks.length, 5) },
  { id: 'checklist_champ', name: 'Checklist Champ', desc: 'Have 10 completed tasks at once', emoji: '✅', rarity: 'common', progress: (d) => ratio(d.todos.filter((t) => t.completed).length, 10) },
  { id: 'dear_diary', name: 'Dear Diary', desc: 'Write 7 journal entries', emoji: '📔', rarity: 'rare', progress: (d) => ratio(Object.values(d.journalEntries).filter((e) => e.text?.trim()).length, 7) },
  { id: 'planner_pro', name: 'Planner Pro', desc: 'Plan 10 blocks in your week', emoji: '🗓️', rarity: 'common', progress: (d) => ratio(Object.keys(d.timetable).length, 10) },
  { id: 'focus_fanatic', name: 'Focus Fanatic', desc: '50 hours of total focus', emoji: '🧠', rarity: 'epic', progress: (d) => ratio(hours(d), 50) },
  { id: 'month_master', name: 'Month Master', desc: 'Keep a 30-day streak', emoji: '🏆', rarity: 'epic', progress: (d) => ratio(d.bestStreak, 30) },
  { id: 'perfectionist', name: 'Unshakeable', desc: '50 sessions finished without ending early', emoji: '✨', rarity: 'epic', progress: (d) => ratio(log(d).filter((s) => s.done).length, 50) },
  { id: 'zen_master', name: 'Zen Master', desc: '100 hours of total focus', emoji: '🧘', rarity: 'legendary', progress: (d) => ratio(hours(d), 100) },
  { id: 'century_club', name: 'Century Club', desc: 'Keep a 100-day streak', emoji: '💎', rarity: 'legendary', progress: (d) => ratio(d.bestStreak, 100) },
];

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; glow: string }> = {
  common: { label: 'Common', ring: '#9ad3a7', glow: 'rgba(120, 200, 140, .35)' },
  rare: { label: 'Rare', ring: '#7fb2ff', glow: 'rgba(110, 160, 255, .4)' },
  epic: { label: 'Epic', ring: '#b58bff', glow: 'rgba(170, 120, 255, .45)' },
  legendary: { label: 'Legendary', ring: '#ffc24a', glow: 'rgba(255, 190, 70, .55)' },
};

export function newlyUnlocked(d: UserData) {
  const have = d.achievements ?? {};
  return ACHIEVEMENTS.filter((a) => !have[a.id] && a.progress(d) >= 1).map((a) => a.id);
}
