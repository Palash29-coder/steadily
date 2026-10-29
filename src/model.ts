export type Kind =
  | "wake"
  | "study"
  | "growth"
  | "skill"
  | "meditation"
  | "custom";
export type Tracking = "checkbox" | "duration" | "count" | "window";
export type Version = {
  id: string;
  habit_id: string;
  user_id: string;
  effective_from: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  tracking: Tracking;
  target: number;
  unit: string;
  wake_start: string;
  wake_end: string;
  early_ok: boolean;
  recurrence: "daily" | "weekdays" | "once";
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  archived: boolean;
  reminder: string;
  skill_rule: "session" | "minutes";
};
export type Habit = {
  id: string;
  user_id: string;
  kind: Kind;
  position: number;
  created_at: string;
};
export type RecordRow = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number;
  checked: boolean;
  time: string;
  title: string;
  source: string;
  takeaway: string;
  reflection: string;
  notes: string;
};
export type Segment = { start: string; end: string };
export type Session = {
  id: string;
  user_id: string;
  kind: "study" | "meditation" | "skill";
  date: string;
  timezone: string;
  label: string;
  notes: string;
  minutes: number;
  segments: Segment[];
  running_since: string | null;
  state: "running" | "paused" | "finished";
  created_at: string;
};
export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  priority: string;
  category: string;
  notes: string;
  recurrence: "once" | "daily" | "weekdays";
  weekdays: number[];
  end_date: string | null;
  completed_dates: string[];
  subtasks: { title: string; completed_dates: string[] }[];
};
export type Journal = {
  id: string;
  user_id: string;
  date: string;
  mood: string;
  went_well: string;
  learned: string;
  improve: string;
};
export type Profile = {
  user_id: string;
  name: string;
  timezone: string;
  week_start: number;
  theme: "light" | "dark" | "system";
  reminders: boolean;
};
export type Data = {
  habits: Habit[];
  versions: Version[];
  records: RecordRow[];
  sessions: Session[];
  tasks: Task[];
  journals: Journal[];
};
export const emptyData = (): Data => ({
  habits: [],
  versions: [],
  records: [],
  sessions: [],
  tasks: [],
  journals: [],
});
export const defaultProfile = (user_id: string): Profile => ({
  user_id,
  name: "",
  timezone: "Asia/Kolkata",
  week_start: 1,
  theme: "light",
  reminders: false,
});
export const uid = () => crypto.randomUUID();
