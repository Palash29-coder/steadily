import { describe, it, expect } from "vitest";
import {
  emptyData,
  type Data,
  type Version,
  type Habit,
  type Session,
} from "../src/model";
import {
  inWindow,
  scheduled,
  versionAt,
  daySummary,
  periodSummary,
  streak,
  longestStreak,
  splitInterval,
  timerSeconds,
  sessionMinutes,
  localDate,
  startOfWeek,
} from "../src/core";
const v: Version = {
  id: "v",
  habit_id: "h",
  user_id: "a",
  effective_from: "2026-10-01",
  name: "Read",
  description: "",
  category: "Growth",
  icon: "spark",
  color: "green",
  tracking: "checkbox",
  target: 1,
  unit: "",
  wake_start: "06:30",
  wake_end: "07:00",
  early_ok: false,
  recurrence: "daily",
  weekdays: [1, 2, 3, 4, 5],
  start_date: "2026-10-01",
  end_date: null,
  archived: false,
  reminder: "",
  skill_rule: "session",
};
const h: Habit = {
  id: "h",
  user_id: "a",
  kind: "custom",
  position: 0,
  created_at: "2026-10-01",
};
const fixture = (): Data => ({ ...emptyData(), habits: [h], versions: [v] });
function complete(d: Data, date: string) {
  d.records.push({
    id: date,
    user_id: "a",
    habit_id: "h",
    date,
    value: 0,
    checked: true,
    time: "",
    title: "",
    source: "",
    takeaway: "",
    reflection: "",
    notes: "",
  });
}
const session: Session = {
  id: "s",
  user_id: "a",
  kind: "study",
  date: "2026-10-01",
  timezone: "Asia/Kolkata",
  label: "Math",
  notes: "",
  minutes: 0,
  state: "finished",
  running_since: null,
  created_at: "2026-10-01",
  segments: [{ start: "2026-10-01T18:00:00Z", end: "2026-10-01T19:00:00Z" }],
};
describe("wake windows", () => {
  it("includes endpoints", () => {
    expect(inWindow("06:30", "06:30", "07:00")).toBe(true);
    expect(inWindow("07:00", "06:30", "07:00")).toBe(true);
  });
  it("counts earlier times only with explicit permission", () => {
    expect(inWindow("06:29", "06:30", "07:00")).toBe(false);
    expect(inWindow("06:29", "06:30", "07:00", true)).toBe(true);
    expect(inWindow("07:01", "06:30", "07:00", true)).toBe(false);
  });
  it("supports overnight and missing values", () => {
    expect(inWindow("00:20", "23:00", "01:00")).toBe(true);
    expect(inWindow("12:00", "23:00", "01:00")).toBe(false);
    expect(inWindow("", "06:30", "07:00")).toBe(false);
  });
});
describe("scheduling", () => {
  it("respects weekdays and date boundaries", () => {
    const x = { ...v, recurrence: "weekdays" as const, end_date: "2026-10-15" };
    expect(scheduled(x, "2026-10-05")).toBe(true);
    expect(scheduled(x, "2026-10-04")).toBe(false);
    expect(scheduled(x, "2026-10-16")).toBe(false);
    expect(scheduled(x, "2026-09-30")).toBe(false);
  });
  it("handles one-time and archived definitions", () => {
    expect(scheduled({ ...v, recurrence: "once" }, "2026-10-01")).toBe(true);
    expect(scheduled({ ...v, recurrence: "once" }, "2026-10-02")).toBe(false);
    expect(scheduled({ ...v, archived: true }, "2026-10-01")).toBe(false);
    expect(scheduled(undefined, "2026-10-01")).toBe(false);
  });
  it("uses effective versions", () => {
    const x = { ...v, id: "v2", target: 20, effective_from: "2026-10-10" };
    expect(versionAt([x, v], "h", "2026-10-09")?.target).toBe(1);
    expect(versionAt([x, v], "h", "2026-10-10")?.target).toBe(20);
  });
  it("preserves historical count completion", () => {
    const d = fixture();
    d.versions = [
      { ...v, tracking: "count", target: 3 },
      {
        ...v,
        id: "v2",
        tracking: "count",
        target: 6,
        effective_from: "2026-10-03",
      },
    ];
    complete(d, "2026-10-02");
    d.records[0].value = 3;
    expect(daySummary(d, "2026-10-02", "2026-10-03").percent).toBe(100);
  });
  it("uses configured week start", () => {
    expect(startOfWeek("2026-10-29", 1)).toBe("2026-10-26");
    expect(startOfWeek("2026-10-29", 0)).toBe("2026-10-25");
  });
});
describe("scoring", () => {
  it("handles no habits", () =>
    expect(
      daySummary(emptyData(), "2026-10-01", "2026-10-01").percent,
    ).toBeNull());
  it("excludes future denominators", () => {
    const d = fixture();
    complete(d, "2026-10-01");
    expect(
      periodSummary(d, "2026-10-01", "2026-10-31", "2026-10-02").percent,
    ).toBe(50);
    expect(daySummary(d, "2026-10-03", "2026-10-02").status).toBe("future");
  });
  it("weights occurrences rather than daily percentages", () => {
    const d = fixture();
    d.habits.push({ ...h, id: "h2" });
    d.versions.push({
      ...v,
      id: "v2",
      habit_id: "h2",
      start_date: "2026-10-02",
    });
    complete(d, "2026-10-01");
    expect(
      periodSummary(d, "2026-10-01", "2026-10-02", "2026-10-02").percent,
    ).toBe(33);
  });
  it("distinguishes unlogged, partial, success", () => {
    const d = fixture();
    expect(daySummary(d, "2026-10-01", "2026-10-02").status).toBe("unlogged");
    complete(d, "2026-10-01");
    d.records[0].checked = false;
    expect(daySummary(d, "2026-10-01", "2026-10-02").status).toBe("partial");
    d.records[0].checked = true;
    expect(daySummary(d, "2026-10-01", "2026-10-02").status).toBe("success");
  });
  it("recalculates past corrections", () => {
    const d = fixture();
    complete(d, "2026-10-01");
    expect(
      periodSummary(d, "2026-10-01", "2026-10-02", "2026-10-02").percent,
    ).toBe(50);
    d.records[0].checked = false;
    expect(
      periodSummary(d, "2026-10-01", "2026-10-02", "2026-10-02").percent,
    ).toBe(0);
  });
});
describe("streaks", () => {
  it("allows today in progress", () => {
    const d = fixture();
    complete(d, "2026-10-01");
    complete(d, "2026-10-02");
    expect(streak(d, "2026-10-03")).toBe(2);
    complete(d, "2026-10-03");
    expect(streak(d, "2026-10-03")).toBe(3);
  });
  it("ignores rest days", () => {
    const d = fixture();
    d.versions = [{ ...v, recurrence: "weekdays", weekdays: [4, 5, 1] }];
    complete(d, "2026-10-01");
    complete(d, "2026-10-02");
    expect(streak(d, "2026-10-05")).toBe(2);
    complete(d, "2026-10-05");
    expect(streak(d, "2026-10-05")).toBe(3);
    expect(longestStreak(d, "2026-10-01", "2026-10-06", "2026-10-06")).toBe(3);
  });
  it("breaks on missed scheduled days", () => {
    const d = fixture();
    complete(d, "2026-10-01");
    expect(streak(d, "2026-10-03")).toBe(0);
  });
});
describe("timers and dates", () => {
  it("splits Kolkata midnight", () => {
    expect(
      splitInterval(
        "2026-10-01T18:00:00Z",
        "2026-10-01T19:00:00Z",
        "Asia/Kolkata",
      ),
    ).toEqual({ "2026-10-01": 30, "2026-10-02": 30 });
  });
  it("handles 25-hour DST days", () => {
    expect(
      splitInterval(
        "2026-11-01T04:00:00Z",
        "2026-11-02T05:00:00Z",
        "America/New_York",
      ),
    ).toEqual({ "2026-11-01": 1500 });
  });
  it("handles 23-hour DST days", () => {
    expect(
      splitInterval(
        "2026-03-08T05:00:00Z",
        "2026-03-09T04:00:00Z",
        "America/New_York",
      ),
    ).toEqual({ "2026-03-08": 1380 });
  });
  it("recovers a serialized running timer", () => {
    const s = JSON.parse(
      JSON.stringify({
        ...session,
        state: "running",
        running_since: "2026-10-02T00:00:00Z",
      }),
    );
    expect(timerSeconds(s, Date.parse("2026-10-02T00:30:00Z"))).toBe(5400);
  });
  it("paused time stays unchanged", () => {
    expect(
      timerSeconds({ ...session, state: "paused" }, Date.parse("2030-01-01")),
    ).toBe(3600);
  });
  it("accumulates sessions and excludes unfinished timers", () => {
    const d = fixture();
    d.habits = [{ ...h, kind: "study" }];
    d.versions = [{ ...v, tracking: "duration", target: 60 }];
    d.sessions = [
      session,
      { ...session, id: "s2" },
      { ...session, id: "s3", state: "paused" },
    ];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(100);
    expect(sessionMinutes({ ...session, state: "paused" }, "2026-10-01")).toBe(
      0,
    );
  });
  it("corrections assign manual time once", () => {
    expect(
      sessionMinutes({ ...session, segments: [], minutes: 95 }, "2026-10-01"),
    ).toBe(95);
    expect(
      sessionMinutes({ ...session, segments: [], minutes: 95 }, "2026-10-02"),
    ).toBe(0);
  });
  it("assigns user-local dates", () => {
    expect(localDate("2026-10-01T20:00:00Z", "Asia/Kolkata")).toBe(
      "2026-10-02",
    );
    expect(localDate("2026-10-01T20:00:00Z", "America/New_York")).toBe(
      "2026-10-01",
    );
  });
  it("ignores invalid or reversed intervals", () => {
    expect(splitInterval("bad", "bad", "UTC")).toEqual({});
    expect(splitInterval("2026-10-02", "2026-10-01", "UTC")).toEqual({});
  });
});

describe("default habits and task separation", () => {
  it("completes growth when checked", () => {
    const d = fixture();
    d.habits = [{ ...h, kind: "growth" }];
    complete(d, "2026-10-01");
    expect(daySummary(d, "2026-10-01", "2026-10-01").completed).toBe(1);
  });
  it("requires one positive skill session or configured minutes", () => {
    const d = fixture();
    d.habits = [{ ...h, kind: "skill" }];
    d.versions = [
      { ...v, tracking: "duration", target: 30, skill_rule: "session" },
    ];
    d.sessions = [{ ...session, kind: "skill", minutes: 10, segments: [] }];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(100);
    d.versions = [{ ...d.versions[0], skill_rule: "minutes" }];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(0);
    d.sessions = [
      ...d.sessions,
      { ...d.sessions[0], id: "skill2", minutes: 20 },
    ];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(100);
  });
  it("accumulates meditation sessions to the target", () => {
    const d = fixture();
    d.habits = [{ ...h, kind: "meditation" }];
    d.versions = [{ ...v, tracking: "duration", target: 30 }];
    d.sessions = [
      { ...session, kind: "meditation", minutes: 10, segments: [] },
      { ...session, id: "m2", kind: "meditation", minutes: 20, segments: [] },
    ];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(100);
  });
  it("excludes tasks from daily habit denominators", () => {
    const d = fixture();
    complete(d, "2026-10-01");
    d.tasks = [
      {
        id: "t",
        user_id: "a",
        title: "Unfinished task",
        description: "",
        date: "2026-10-01",
        priority: "High",
        category: "Home",
        notes: "",
        recurrence: "once",
        weekdays: [],
        end_date: null,
        completed_dates: [],
        subtasks: [],
      },
    ];
    expect(daySummary(d, "2026-10-01", "2026-10-01").percent).toBe(100);
    expect(daySummary(d, "2026-10-01", "2026-10-01").total).toBe(1);
  });
});
