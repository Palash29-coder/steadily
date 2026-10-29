import type { Data, Habit, Version, Session, Task } from "./model";
export function localDate(
  time: Date | string | number = new Date(),
  tz = "Asia/Kolkata",
) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
export function dates(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
export function versionAt(versions: Version[], id: string, date: string) {
  return versions
    .filter((v) => v.habit_id === id && v.effective_from <= date)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}
export function scheduled(v: Version | undefined, date: string) {
  return (
    !!v &&
    !v.archived &&
    date >= v.start_date &&
    (!v.end_date || date <= v.end_date) &&
    (v.recurrence === "daily" ||
      (v.recurrence === "once" && date === v.start_date) ||
      (v.recurrence === "weekdays" && v.weekdays.includes(weekday(date))))
  );
}
export const hm = (s: string) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export function inWindow(
  time: string,
  start: string,
  end: string,
  early = false,
) {
  if (!time) return false;
  const t = hm(time),
    s = hm(start),
    e = hm(end);
  return s <= e ? t <= e && (early || t >= s) : t >= s || t <= e;
}
export function windowLabel(time: string, v: Version) {
  if (!time) return "Not logged";
  if (inWindow(time, v.wake_start, v.wake_end, v.early_ok))
    return "Within your goal";
  return hm(time) < hm(v.wake_start)
    ? "Before your window"
    : "After your window";
}
// Split actual elapsed time at local calendar boundaries, including 23/25 hour DST days.
export function splitInterval(
  start: string,
  end: string,
  tz: string,
): Record<string, number> {
  let a = Date.parse(start);
  const stop = Date.parse(end),
    out: Record<string, number> = {};
  if (!Number.isFinite(a) || !Number.isFinite(stop) || stop <= a) return out;
  while (a < stop) {
    const day = localDate(a, tz);
    let hi = Math.min(stop, a + 27 * 3600000);
    if (localDate(hi - 1, tz) !== day) {
      let lo = a;
      while (hi - lo > 1) {
        const mid = Math.floor((hi + lo) / 2);
        if (localDate(mid, tz) === day) lo = mid;
        else hi = mid;
      }
    }
    const boundary = hi;
    out[day] = (out[day] || 0) + (boundary - a) / 60000;
    a = boundary;
  }
  return out;
}
const sessionDateCache = new WeakMap<Session, Record<string, number>>();
export function sessionMinutes(s: Session, date: string, now = Date.now()) {
  if (s.state !== "finished") return 0;
  if (s.minutes > 0) return s.date === date ? s.minutes : 0;
  let totals = sessionDateCache.get(s);
  if (!totals) {
    totals = {};
    for (const segment of s.segments) {
      for (const [day, minutes] of Object.entries(
        splitInterval(segment.start, segment.end, s.timezone),
      )) {
        totals[day] = (totals[day] || 0) + minutes;
      }
    }
    sessionDateCache.set(s, totals);
  }
  return totals[date] || 0;
}
export function timerSeconds(s: Session, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(
      (s.segments.reduce(
        (n, p) => n + Date.parse(p.end) - Date.parse(p.start),
        0,
      ) +
        (s.running_since
          ? Math.max(0, now - Date.parse(s.running_since))
          : 0)) /
        1000,
    ),
  );
}
export function evaluate(h: Habit, v: Version, date: string, data: Data) {
  const r = data.records.find((x) => x.habit_id === h.id && x.date === date);
  const ss = data.sessions.filter(
    (s) => s.kind === h.kind && s.state === "finished",
  );
  let value = r?.value || 0,
    complete = false;
  if (["study", "meditation", "skill"].includes(h.kind)) {
    value = ss.reduce((n, s) => n + sessionMinutes(s, date), 0);
    complete =
      h.kind === "skill" && v.skill_rule === "session"
        ? ss.some((s) => sessionMinutes(s, date) > 0)
        : value >= v.target;
  } else if (v.tracking === "window")
    complete = inWindow(r?.time || "", v.wake_start, v.wake_end, v.early_ok);
  else if (v.tracking === "checkbox") complete = !!r?.checked;
  else complete = value >= v.target;
  return {
    habit: h,
    version: v,
    record: r,
    value,
    complete,
    logged: !!r || value > 0,
  };
}
export function daySummary(data: Data, date: string, today: string) {
  const items = data.habits
    .map((h) => ({ h, v: versionAt(data.versions, h.id, date) }))
    .filter((x) => scheduled(x.v, date))
    .map((x) => evaluate(x.h, x.v!, date, data));
  const completed = items.filter((x) => x.complete).length;
  return {
    date,
    items,
    total: items.length,
    completed,
    percent: items.length ? Math.round((completed / items.length) * 100) : null,
    status:
      date > today
        ? "future"
        : !items.length
          ? "unscheduled"
          : completed === items.length
            ? "success"
            : items.some((x) => x.logged)
              ? "partial"
              : "unlogged",
  };
}
export function periodSummary(
  data: Data,
  start: string,
  end: string,
  today: string,
) {
  const days = dates(start, end < today ? end : today).map((d) =>
    daySummary(data, d, today),
  );
  const scheduledCount = days.reduce((n, d) => n + d.total, 0),
    completed = days.reduce((n, d) => n + d.completed, 0);
  return {
    days,
    scheduled: scheduledCount,
    completed,
    missed: scheduledCount - completed,
    percent: scheduledCount
      ? Math.round((completed / scheduledCount) * 100)
      : null,
    successes: days.filter((d) => d.status === "success").length,
    study: days.reduce(
      (n, d) =>
        n +
        data.sessions
          .filter((s) => s.kind === "study")
          .reduce((a, s) => a + sessionMinutes(s, d.date), 0),
      0,
    ),
    meditation: days.reduce(
      (n, d) =>
        n +
        data.sessions
          .filter((s) => s.kind === "meditation")
          .reduce((a, s) => a + sessionMinutes(s, d.date), 0),
      0,
    ),
  };
}
export function streak(data: Data, today: string) {
  const starts = data.versions.map((v) => v.start_date).sort();
  if (!starts.length) return 0;
  let count = 0;
  for (let d = today; d >= starts[0]; d = addDays(d, -1)) {
    const s = daySummary(data, d, today);
    if (!s.total) continue;
    if (s.status === "success") count++;
    else if (d !== today) break;
  }
  return count;
}
export function longestStreak(
  data: Data,
  start: string,
  end: string,
  today: string,
) {
  let best = 0,
    run = 0;
  for (const d of dates(start, end < today ? end : today)) {
    const s = daySummary(data, d, today);
    if (!s.total) continue;
    run = s.status === "success" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
export function taskScheduled(t: Task, date: string) {
  return (
    date >= t.date &&
    (!t.end_date || date <= t.end_date) &&
    (t.recurrence === "daily" ||
      (t.recurrence === "once" && date === t.date) ||
      (t.recurrence === "weekdays" && t.weekdays.includes(weekday(date))))
  );
}
export function startOfWeek(date: string, start: number) {
  return addDays(date, -((weekday(date) - start + 7) % 7));
}
export function monthBounds(date: string) {
  const start = date.slice(0, 7) + "-01",
    d = new Date(`${start}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return [start, addDays(d.toISOString().slice(0, 10), -1)];
}
export const duration = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m`
    : `${Math.floor(m)}m`;
export const pretty = (
  d: string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", options);
