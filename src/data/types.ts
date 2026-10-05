/**
 * User data model. Field names intentionally match YouFloww v2 so that existing
 * Firestore docs (users/{uid}) and guest data (localStorage `youfloww_guest`)
 * load without migration. New v3 fields are additive and optional.
 */

export type SoundProfile = 'indian' | 'chimes' | 'off';

export interface Subtask {
  id?: string;
  text: string;
  completed: boolean;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  subtasks: Subtask[];
  estimateMinutes?: number;
  loggedSeconds?: number;
  loggedMinutes?: number;
  createdAt?: number;
  completedAt?: number | null;
  canonicalId?: string | null;
  /** v3: flag a task as today's priority */
  starred?: boolean;
}

export interface RegularTask {
  id: string;
  name: string;
  color?: string;
}

export interface JournalEntry {
  text: string;
  date: string;
  image?: string | null;
  /** v3 */
  mood?: number | null;
  gratitude?: string;
  updatedAt?: number;
}

export interface TimeSlot {
  day: string; // monday..sunday
  start: string; // HH:MM 24h
  end: string;
  activity: string;
  completed: boolean;
}

export interface SessionLogEntry {
  at: number; // start timestamp
  sec: number;
  done: boolean; // completed naturally vs ended early
  task?: string | null;
  cat?: string | null;
  rating?: number | null;
  note?: string | null;
}

export interface Settings {
  workDuration: number; // seconds
  shortBreakDuration: number;
  longBreakDuration: number;
  soundProfile: SoundProfile;
  isAccountabilityOn: boolean;
  /** v3 */
  longBreakInterval?: number;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
  dailyGoalMinutes?: number;
  notifications?: boolean;
  keepAwake?: boolean;
  ambienceOnlyWhileFocusing?: boolean;
  tickSound?: boolean;
  use24h?: boolean;
}

export interface UserData {
  profileName: string;
  totalFocusMinutes: number;
  totalFocusSeconds: number;
  totalSessions: number;
  streakCount: number;
  bestStreak: number;
  lastStreakDate: string | null;
  longestSession: number; // minutes
  todaySessions: number;
  lastSessionDate: string | null;
  weeklyFocus: Record<string, number>;
  weeklyFocusSeconds: Record<string, number>;
  weeklySessions: Record<string, number>;
  weeklyCompletedSessions: Record<string, number>;
  weeklyEarlyEndedSessions: Record<string, number>;
  weeklyAnonymousSeconds: Record<string, number>;
  weeklyAnonymousSessions: Record<string, number>;
  weeklyTaskSecondsByDate: Record<string, Record<string, number>>;
  weeklyCategorySecondsByDate: Record<string, Record<string, number>>;
  weeklyCategoryCompletionsByDate: Record<string, Record<string, number>>;
  regularTasks: RegularTask[];
  todos: Todo[];
  journalEntries: Record<string, JournalEntry>;
  timetable: Record<string, TimeSlot>;
  settings: Settings;
  theme?: { backgroundPath: string | null; youtubeVideoId: string | null };
  createdAt?: number;

  /** v3: long-lived daily history for heatmaps (kept ~400 days) */
  dailyFocusSeconds?: Record<string, number>;
  /** v3: cumulative focus seconds per hour of day (24 buckets) */
  hourlyFocusSeconds?: number[];
  /** v3: recent sessions, newest last (kept 150) */
  sessionLog?: SessionLogEntry[];
  /** v3: achievement id -> unlock timestamp */
  achievements?: Record<string, number>;
  /** v3: last write timestamp, for multi-device conflict resolution */
  updatedAt?: number;
  /** v3: onboarding flag */
  onboarded?: boolean;
  [key: string]: unknown;
}
