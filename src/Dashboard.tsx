import { useEffect, useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Square,
  ArrowUpRight,
  Check,
  ChevronRight,
  Pencil,
  Trash2,
  Flame,
  MoreHorizontal,
  BookOpen,
  Wind,
  CalendarDays,
  ChevronLeft,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useStore } from "./store";
import {
  type Habit,
  type Version,
  type Session,
  type Task,
  uid,
} from "./model";
import {
  daySummary,
  duration,
  pretty,
  streak,
  localDate,
  timerSeconds,
  windowLabel,
  taskScheduled,
  addDays,
  startOfWeek,
  sessionMinutes,
} from "./core";
import {
  Icon,
  Button,
  Modal,
  Progress,
  Ring,
  Plant,
  Empty,
} from "./components";
import {
  RecordForm,
  SessionForm,
  TaskForm,
  JournalForm,
  HabitForm,
} from "./forms";
export type Dialog =
  | { type: "record"; habit: Habit; version: Version; date: string }
  | { type: "session"; kind: Session["kind"]; date: string; session?: Session }
  | { type: "task"; date: string; task?: Task }
  | { type: "journal"; date: string }
  | { type: "habit"; habit?: Habit }
  | { type: "quick"; date: string }
  | { type: "delete"; key: "tasks" | "sessions"; id: string };
export function DialogView({
  dialog,
  close,
  setDialog,
}: {
  dialog: Dialog;
  close: () => void;
  setDialog: (d: Dialog) => void;
}) {
  const { remove } = useStore();
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const d = dialog;
  const title =
    d.type === "record"
      ? d.version.name
      : d.type === "session"
        ? (d.session ? "Edit" : "Log") + ` ${d.kind} session`
        : d.type === "task"
          ? d.task
            ? "Edit task"
            : "One thing at a time"
          : d.type === "journal"
            ? "A moment to reflect"
            : d.type === "habit"
              ? d.habit
                ? "Make it your own"
                : "Make room for a new habit"
              : d.type === "quick"
                ? "What would you like to add?"
                : "Delete this record?";
  return (
    <Modal title={title} onClose={close}>
      {d.type === "record" ? (
        <RecordForm {...d} onDone={close} />
      ) : d.type === "session" ? (
        <SessionForm {...d} onDone={close} />
      ) : d.type === "task" ? (
        <TaskForm {...d} onDone={close} />
      ) : d.type === "journal" ? (
        <JournalForm date={d.date} onDone={close} />
      ) : d.type === "habit" ? (
        <HabitForm habit={d.habit} onDone={close} />
      ) : d.type === "quick" ? (
        <div className="quick-options">
          {[
            ["task", "A task", "Something to get done"],
            ["habit", "A new habit", "A practice to come back to"],
            ["study", "Study time", "Make your focus count"],
            ["meditation", "Meditation", "A little space to breathe"],
            ["skill", "Skill practice", "Follow your curiosity"],
          ].map(([t, label, desc]) => (
            <button
              key={t}
              onClick={() =>
                setDialog(
                  t === "task"
                    ? { type: "task", date: d.date }
                    : t === "habit"
                      ? { type: "habit" }
                      : {
                          type: "session",
                          date: d.date,
                          kind: t as Session["kind"],
                        },
                )
              }
            >
              <span className="icon-tile green">
                <Icon name={t} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{desc}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <p>
            Deleting permanently removes this{" "}
            {d.key === "tasks"
              ? "task, its subtasks, and completion history"
              : "session and its duration from your summaries"}
            . This cannot be undone.
          </p>
          {err && <p className="error">{err}</p>}
          <div className="form-footer">
            <Button variant="secondary" onClick={close}>
              Keep record
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove(d.key, d.id);
                  close();
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete permanently
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
function Timer({ kind, date }: { kind: Session["kind"]; date: string }) {
  const { data, timer, profile, demo } = useStore();
  const active = data.sessions.find(
    (s) => s.kind === kind && s.state !== "finished",
  );
  const [now, setNow] = useState(Date.now()),
    [label, setLabel] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [timerId, setTimerId] = useState(uid);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  async function transition(action: string) {
    setBusy(true);
    setError("");
    const s: Session = active || {
      id: timerId,
      user_id: demo ? "demo" : profile.user_id,
      kind,
      date,
      timezone: profile.timezone,
      label: label || kind,
      notes: "",
      minutes: 0,
      segments: [],
      running_since: null,
      state: "paused",
      created_at: new Date().toISOString(),
    };
    try {
      await timer(s, action);
      if (action === "finish") {
        setLabel("");
        setTimerId(uid());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const seconds = active ? timerSeconds(active, now) : 0;
  return (
    <div className="timer">
      <div className="timer-top">
        <span className={active?.state === "running" ? "live-dot" : ""}>
          {active?.state === "running"
            ? "Focus in progress"
            : active?.state === "paused"
              ? "Paused · take your time"
              : "Ready when you are"}
        </span>
        <span className="timer-digits">
          {String(Math.floor(seconds / 3600)).padStart(2, "0")}:
          {String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      {!active ? (
        <input
          className="timer-label"
          aria-label={`${kind} timer label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            kind === "study"
              ? "What are you focusing on?"
              : "Name your session (optional)"
          }
        />
      ) : (
        <p className="small muted">
          {active.label} · Recovers after refresh
          {active.date !== date ? ` · Started ${active.date}` : ""}
        </p>
      )}
      <div className="timer-actions">
        {!active ? (
          <Button
            variant="soft"
            disabled={busy}
            onClick={() => transition("start")}
          >
            <Play size={14} />
            Start timer
          </Button>
        ) : (
          <>
            <Button
              variant="soft"
              disabled={busy}
              onClick={() =>
                transition(active.state === "running" ? "pause" : "resume")
              }
            >
              {active.state === "running" ? (
                <Pause size={14} />
              ) : (
                <Play size={14} />
              )}
              {active.state === "running" ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => transition("finish")}
            >
              <Square size={13} />
              Finish & log
            </Button>
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error} Retry the same action.
        </p>
      )}
    </div>
  );
}
export function HabitCards({
  date,
  onDialog,
}: {
  date: string;
  onDialog: (d: Dialog) => void;
}) {
  const { data, profile } = useStore();
  const today = localDate(new Date(), profile.timezone),
    summary = daySummary(data, date, today),
    future = date > today;
  return (
    <div className="habit-grid">
      {summary.items
        .sort((a, b) => a.habit.position - b.habit.position)
        .map((item) => {
          const { habit: h, version: v, record: r, value, complete } = item;
          const timed = h.kind === "study" || h.kind === "meditation";
          let subtitle =
            v.tracking === "window"
              ? `${v.wake_start} – ${v.wake_end}${v.early_ok ? " · earlier counts" : ""}`
              : v.tracking === "checkbox"
                ? "One meaningful moment, every day"
                : h.kind === "skill" && v.skill_rule === "session"
                  ? "One practice session today"
                  : `${v.target} ${v.unit || "min"} a day`;
          const fraction =
            v.tracking === "checkbox" ||
            v.tracking === "window" ||
            (h.kind === "skill" && v.skill_rule === "session")
              ? complete
                ? 100
                : 0
              : (value / v.target) * 100;
          return (
            <article
              className={`habit-card ${complete ? "is-complete" : ""}`}
              key={h.id}
            >
              <div className="habit-heading">
                <span className={`icon-tile ${v.color}`}>
                  <Icon name={v.icon} />
                </span>
                <div>
                  <h3>{v.name}</h3>
                  <p>{subtitle}</p>
                </div>
                <span
                  className={`completion-mark ${complete ? "done" : ""}`}
                  title={complete ? "Completed" : "Not yet completed"}
                >
                  {complete ? <Check size={16} /> : <span />}
                </span>
              </div>
              {v.tracking === "window" ? (
                <div className="habit-value">
                  <strong>
                    {r?.time
                      ? new Date(`2000-01-01T${r.time}`).toLocaleTimeString(
                          "en-US",
                          { hour: "numeric", minute: "2-digit" },
                        )
                      : "— —"}
                  </strong>
                  <span className={complete ? "positive" : "muted"}>
                    {windowLabel(r?.time || "", v)}
                  </span>
                </div>
              ) : v.tracking === "checkbox" ? (
                <div className="habit-copy">
                  <p>{r?.title || "A page, a podcast, a fresh perspective."}</p>
                  <span>
                    {complete
                      ? "Lesson completed. Let it sink in."
                      : "What will you discover today?"}
                  </span>
                </div>
              ) : (
                <>
                  <div className="habit-value">
                    <strong>
                      {v.tracking === "count"
                        ? `${value} ${v.unit}`
                        : duration(value)}
                    </strong>
                    <span>
                      {h.kind === "skill" && v.skill_rule === "session"
                        ? complete
                          ? "Practice logged"
                          : "A little practice goes a long way"
                        : `/ ${v.tracking === "count" ? `${v.target} ${v.unit}` : duration(v.target)} goal`}
                    </span>
                  </div>
                  <Progress percent={fraction} color={v.color} />
                  <p className="remaining">
                    {complete
                      ? "Your intention, fulfilled."
                      : h.kind === "skill" && v.skill_rule === "session"
                        ? "Every beginning is progress."
                        : `${v.tracking === "count" ? `${Math.max(0, v.target - value)} ${v.unit}` : duration(Math.max(0, v.target - value))} to your daily goal`}
                  </p>
                </>
              )}
              {profile.reminders && v.reminder && (
                <p className="small muted">Reminder: {v.reminder}</p>
              )}
              {timed && date === today && (
                <Timer kind={h.kind as "study" | "meditation"} date={date} />
              )}
              <div className="habit-footer">
                <span>
                  {complete ? (
                    <>
                      <Check size={13} /> Completed
                    </>
                  ) : (
                    <>
                      <span className="tiny-dot" />{" "}
                      {future ? "Upcoming" : "In progress"}
                    </>
                  )}
                </span>
                <button
                  className="text-button"
                  disabled={future}
                  onClick={() =>
                    onDialog(
                      timed || h.kind === "skill"
                        ? {
                            type: "session",
                            date,
                            kind: h.kind as Session["kind"],
                          }
                        : { type: "record", date, habit: h, version: v },
                    )
                  }
                >
                  {timed
                    ? "Add time"
                    : h.kind === "skill"
                      ? "Log practice"
                      : r
                        ? "Edit entry"
                        : "Log entry"}
                  <Plus size={14} />
                </button>
              </div>
            </article>
          );
        })}
      {!summary.total && (
        <Empty title="No habits scheduled">
          <p>Leave room to rest, or add an intention for this day.</p>
          <Button
            variant="secondary"
            onClick={() => onDialog({ type: "habit" })}
          >
            <Plus size={16} />
            Add a habit
          </Button>
        </Empty>
      )}
    </div>
  );
}
export function Tasks({
  date,
  onDialog,
}: {
  date: string;
  onDialog: (d: Dialog) => void;
}) {
  const { data, save, profile } = useStore();
  const [err, setErr] = useState(""),
    [pending, setPending] = useState(false);
  const items = data.tasks.filter((t) => taskScheduled(t, date)),
    done = items.filter((t) => t.completed_dates.includes(date)).length;
  const today = localDate(new Date(), profile.timezone);
  async function toggle(t: Task, sub?: number) {
    setPending(true);
    setErr("");
    const flip = (list: string[]) =>
      list.includes(date) ? list.filter((d) => d !== date) : [...list, date];
    try {
      await save(
        "tasks",
        sub === undefined
          ? { ...t, completed_dates: flip(t.completed_dates) }
          : {
              ...t,
              subtasks: t.subtasks.map((s, i) =>
                i === sub
                  ? { ...s, completed_dates: flip(s.completed_dates) }
                  : s,
              ),
            },
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel task-panel">
      <div className="section-heading">
        <div>
          <h2>
            Your little to-do list{" "}
            <span className="count-pill">
              {done}/{items.length}
            </span>
          </h2>
          <p>Separate from your habits. Just a little more clarity.</p>
        </div>
        <button
          className="text-button"
          onClick={() => onDialog({ type: "task", date })}
        >
          <Plus size={16} />
          Add task
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {!items.length ? (
        <p className="muted task-empty">
          A clear list. Add something when you’re ready.
        </p>
      ) : (
        items.map((t) => (
          <div className="task-group" key={t.id}>
            <div className="task-row">
              <input
                type="checkbox"
                aria-label={`Complete ${t.title}`}
                checked={t.completed_dates.includes(date)}
                disabled={pending || date > today}
                onChange={() => toggle(t)}
              />
              <div
                className={
                  t.completed_dates.includes(date) ? "task-complete" : ""
                }
              >
                <strong>{t.title}</strong>
                {t.description && <small>{t.description}</small>}
              </div>
              <span className={`priority ${t.priority.toLowerCase()}`}>
                {t.priority}
              </span>
              <button
                className="icon-button"
                aria-label={`Edit ${t.title}`}
                onClick={() => onDialog({ type: "task", date, task: t })}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={`Delete ${t.title}`}
                onClick={() =>
                  onDialog({ type: "delete", key: "tasks", id: t.id })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
            {t.subtasks.map((s, i) => (
              <label className="subtask" key={i}>
                <input
                  type="checkbox"
                  checked={s.completed_dates.includes(date)}
                  disabled={pending || date > today}
                  onChange={() => toggle(t, i)}
                />
                {s.title}
              </label>
            ))}
            {t.notes && <p className="task-notes muted">{t.notes}</p>}
          </div>
        ))
      )}
    </section>
  );
}
export function SessionList({
  date,
  onDialog,
}: {
  date: string;
  onDialog: (d: Dialog) => void;
}) {
  const { data } = useStore();
  const ss = data.sessions.filter(
    (s) =>
      s.state === "finished" &&
      (sessionMinutes(s, date) > 0 ||
        (s.date === date && s.minutes === 0 && s.segments.length === 0)),
  );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Session notebook</h2>
          <p>Your focus, practice, and quiet moments.</p>
        </div>
      </div>
      {!ss.length ? (
        <p className="muted">No completed sessions for this day yet.</p>
      ) : (
        ss.map((s) => (
          <div className="session-row" key={s.id}>
            <span className="icon-tile compact green">
              <Icon name={s.kind} />
            </span>
            <div>
              <strong>{s.label || s.kind}</strong>
              <small>
                {s.kind} · {duration(sessionMinutes(s, date))}
              </small>
              {s.notes && <p>{s.notes}</p>}
            </div>
            <button
              className="icon-button"
              aria-label={`Edit ${s.label}`}
              onClick={() =>
                onDialog({
                  type: "session",
                  kind: s.kind,
                  date: s.date,
                  session: s,
                })
              }
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`Delete ${s.label}`}
              onClick={() =>
                onDialog({ type: "delete", key: "sessions", id: s.id })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))
      )}
    </section>
  );
}
export function Today({
  onDialog,
  navigate,
}: {
  onDialog: (d: Dialog) => void;
  navigate: (page: string) => void;
}) {
  const { data, profile } = useStore();
  const today = localDate(new Date(), profile.timezone),
    s = daySummary(data, today, today),
    run = streak(data, today);
  const week = startOfWeek(today, profile.week_start),
    chart = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i);
      return {
        day: pretty(date, { weekday: "short" }).slice(0, 1),
        date,
        value: date > today ? undefined : daySummary(data, date, today).percent,
      };
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {pretty(today, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).toUpperCase()}
          </span>
          <h1>
            A little better, every day<span className="heading-dot">.</span>
          </h1>
          <p>
            Welcome{profile.name ? ` back, ${profile.name.split(" ")[0]}` : ""}.
            Let’s make space for what matters.
          </p>
        </div>
        <Button onClick={() => onDialog({ type: "quick", date: today })}>
          <Plus size={17} />
          Quick add
        </Button>
      </div>
      <section className="day-banner">
        <div className="banner-message">
          <span className="eyebrow">YOUR DAY, AT A GLANCE</span>
          <h2>
            {s.percent === 100
              ? "Look at you, showing up."
              : "Progress starts with showing up."}
          </h2>
          <p>
            Little by little, a little becomes a lot.
            <br />
            You don’t have to do it all at once.
          </p>
          <span className="streak-badge">
            <Flame size={15} />
            {run ? `${run}-day success streak` : "A fresh chance to begin"}
            <span>Keep growing</span>
          </span>
        </div>
        <Plant />
        <div className="banner-progress">
          <Ring percent={s.percent || 0} />
          <div>
            <strong>
              {s.total
                ? `${s.completed} of ${s.total} goals completed`
                : "No habits scheduled"}
            </strong>
            <span>
              {s.percent === 100
                ? "Take a moment to appreciate it."
                : "Every small step moves you forward."}
            </span>
          </div>
        </div>
      </section>
      {data.sessions
        .filter(
          (t) =>
            t.state !== "finished" &&
            !s.items.some((i) => i.habit.kind === t.kind),
        )
        .map((t) => (
          <section className="panel" key={t.id}>
            <h2>Unfinished {t.kind} session</h2>
            <Timer kind={t.kind} date={today} />
          </section>
        ))}
      <div className="metric-grid">
        <div className="metric-card">
          <span className="icon-tile blue">
            <BookOpen size={21} />
          </span>
          <div>
            <span>Study time</span>
            <strong>
              {duration(
                s.items.find((x) => x.habit.kind === "study")?.value || 0,
              )}
              <small>
                {" "}
                /{" "}
                {duration(
                  s.items.find((x) => x.habit.kind === "study")?.version
                    .target || 240,
                )}
              </small>
            </strong>
          </div>
          <span className="metric-caption">Deep work, real growth</span>
        </div>
        <div className="metric-card">
          <span className="icon-tile green">
            <Wind size={22} />
          </span>
          <div>
            <span>Mindful minutes</span>
            <strong>
              {duration(
                s.items.find((x) => x.habit.kind === "meditation")?.value || 0,
              )}
              <small>
                {" "}
                /{" "}
                {duration(
                  s.items.find((x) => x.habit.kind === "meditation")?.version
                    .target || 30,
                )}
              </small>
            </strong>
          </div>
          <span className="metric-caption">A calmer kind of progress</span>
        </div>
        <div className="metric-card">
          <span className="icon-tile amber">
            <Flame size={21} />
          </span>
          <div>
            <span>Daily success streak</span>
            <strong>
              {run}
              <small> {run === 1 ? "day" : "days"}</small>
            </strong>
          </div>
          <span className="metric-caption">Today has room to unfold</span>
        </div>
      </div>
      <div className="section-heading habits-heading">
        <div>
          <h2>
            Your daily intentions <span className="count-pill">{s.total}</span>
          </h2>
          <p>A few good habits. A life that feels more like you.</p>
        </div>
        <button className="text-button" onClick={() => navigate("habits")}>
          Manage habits
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="today-columns">
        <div>
          <HabitCards date={today} onDialog={onDialog} />
          <Tasks date={today} onDialog={onDialog} />
        </div>
        <aside className="right-column">
          <section className="panel week-panel">
            <div className="section-heading">
              <h2>This week</h2>
              <span className="small muted">So far</span>
            </div>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={135}>
                <BarChart
                  data={chart}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#79857d" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--soft)" }}
                    formatter={(v) => [`${v}%`, "Habits complete"]}
                    labelFormatter={(_, p) => p[0]?.payload.date || ""}
                  />
                  <Bar
                    dataKey="value"
                    fill="#91aa8b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="small muted">Consistency grows one day at a time.</p>
            <button
              className="text-button"
              onClick={() => navigate("analytics")}
            >
              Explore your progress
              <ArrowUpRight size={15} />
            </button>
          </section>
          <section className="reflection-card">
            <span className="reflection-symbol">✧</span>
            <span className="eyebrow">PAUSE & REFLECT</span>
            <h2>
              How’s your
              <br />
              day feeling?
            </h2>
            <p>
              A thought, a win, a lesson.
              <br />
              Make a little room for yourself.
            </p>
            <Button
              variant="secondary"
              onClick={() => onDialog({ type: "journal", date: today })}
            >
              {data.journals.some((j) => j.date === today)
                ? "Edit your reflection"
                : "Write a reflection"}
              <Pencil size={14} />
            </Button>
          </section>
          <div className="gentle-note">
            <SproutIcon />
            <p>
              You’re building a life,
              <br />
              not just checking boxes.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function SproutIcon() {
  return <Icon name="skill" size={24} />;
}
