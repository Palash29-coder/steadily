import { createClient } from "@supabase/supabase-js";
import {
  type Data,
  type Profile,
  type Version,
  type Session,
  emptyData,
  defaultProfile,
  uid,
} from "./model";
import { localDate, addDays } from "./core";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key && !url.includes("YOUR_PROJECT") ? createClient(url, key) : null;
export const tables = {
  habits: "habits",
  versions: "habit_versions",
  records: "daily_records",
  sessions: "sessions",
  tasks: "tasks",
  journals: "journals",
} as const;
export async function fetchData(user: string): Promise<Data> {
  const entries = await Promise.all(
    Object.entries(tables).map(async ([name, table]) => {
      const all: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase!
          .from(table)
          .select("*")
          .eq("user_id", user)
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        all.push(...data);
        if (data.length < 500) break;
      }
      return [name, all];
    }),
  );
  return Object.fromEntries(entries) as Data;
}
export async function fetchProfile(user: string): Promise<Profile> {
  const { data, error } = await supabase!
    .from("profiles")
    .select("*")
    .eq("user_id", user)
    .single();
  if (error) throw error;
  return data;
}
export function demoData(today: string): Data {
  const d = emptyData(),
    who = "demo";
  const start = addDays(today, -35);
  const names = [
    "Rise & shine",
    "Deep work",
    "A little wiser",
    "Build a skill",
    "Find your calm",
  ];
  (["wake", "study", "growth", "skill", "meditation"] as const).forEach(
    (kind, i) => {
      const id = `demo-${kind}`;
      d.habits.push({
        id,
        user_id: who,
        kind,
        position: i,
        created_at: new Date().toISOString(),
      });
      d.versions.push({
        id: uid(),
        user_id: who,
        habit_id: id,
        effective_from: start,
        name: names[i],
        description: "",
        category:
          i === 1 || i === 3 ? "Learning" : i === 2 ? "Growth" : "Wellbeing",
        icon: kind,
        color: ["amber", "blue", "purple", "green", "green"][i],
        tracking: i === 0 ? "window" : i === 2 ? "checkbox" : "duration",
        target: i === 1 ? 240 : i === 4 ? 30 : 1,
        unit: "min",
        wake_start: "06:30",
        wake_end: "07:00",
        early_ok: false,
        recurrence: "daily",
        weekdays: [1, 2, 3, 4, 5],
        start_date: start,
        end_date: null,
        archived: false,
        reminder: "",
        skill_rule: "session",
      });
    },
  );
  for (let n = 35; n >= 0; n--) {
    const date = addDays(today, -n);
    if (n % 9 === 0 && n !== 0) continue;
    for (const h of d.habits) {
      if (h.kind === "wake" || h.kind === "growth") {
        if (n === 0 && h.kind === "growth") continue;
        d.records.push({
          id: uid(),
          user_id: who,
          habit_id: h.id,
          date,
          value: 0,
          checked: h.kind === "growth" && n % 5 !== 0,
          time: n % 6 === 0 ? "07:15" : "06:45",
          title: h.kind === "growth" ? "The power of small steps" : "",
          source: "",
          takeaway: "Make the next step small enough to begin.",
          reflection: "",
          notes: "",
        });
      } else {
        const m =
          h.kind === "study"
            ? n === 0
              ? 95
              : 120 + (n % 5) * 45
            : h.kind === "meditation"
              ? n === 0
                ? 10
                : 20 + (n % 3) * 10
              : n === 0
                ? 0
                : 20;
        if (m)
          d.sessions.push({
            id: uid(),
            user_id: who,
            kind: h.kind as Session["kind"],
            date,
            timezone: "Asia/Kolkata",
            label:
              h.kind === "study"
                ? "Learning, one chapter at a time"
                : h.kind === "skill"
                  ? "Creative writing"
                  : "Morning reset",
            notes: "",
            minutes: m,
            segments: [],
            running_since: null,
            state: "finished",
            created_at: new Date().toISOString(),
          });
      }
    }
  }
  d.tasks.push(
    {
      id: uid(),
      user_id: who,
      title: "Plan tomorrow’s study session",
      description: "Choose one topic to focus on.",
      date: today,
      priority: "Medium",
      category: "Learning",
      notes: "",
      recurrence: "once",
      weekdays: [1, 2, 3, 4, 5],
      end_date: null,
      completed_dates: [],
      subtasks: [],
    },
    {
      id: uid(),
      user_id: who,
      title: "Take a walk outside",
      description: "A little fresh air between sessions.",
      date: today,
      priority: "Low",
      category: "Wellbeing",
      notes: "",
      recurrence: "once",
      weekdays: [],
      end_date: null,
      completed_dates: [today],
      subtasks: [],
    },
  );
  return d;
}
export const demoProfile = () => ({ ...defaultProfile("demo"), name: "Alex" });
export function baseVersion(
  habit_id: string,
  date: string,
  user_id: string,
): Version {
  return {
    id: uid(),
    habit_id,
    user_id,
    effective_from: date,
    name: "",
    description: "",
    category: "Personal",
    icon: "spark",
    color: "green",
    tracking: "checkbox",
    target: 1,
    unit: "times",
    wake_start: "06:30",
    wake_end: "07:00",
    early_ok: false,
    recurrence: "daily",
    weekdays: [1, 2, 3, 4, 5],
    start_date: date,
    end_date: null,
    archived: false,
    reminder: "",
    skill_rule: "session",
  };
}
