import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useStore } from "./store";
import {
  localDate,
  addDays,
  startOfWeek,
  monthBounds,
  periodSummary,
  dates,
  daySummary,
  pretty,
  sessionMinutes,
  duration,
  longestStreak,
  versionAt,
} from "./core";
import { Empty, Progress } from "./components";
import { Legend } from "./History";
export function Analytics() {
  const { data, profile } = useStore(),
    today = localDate(new Date(), profile.timezone);
  const [mode, setMode] = useState<"week" | "month">("week"),
    [anchor, setAnchor] = useState(today),
    [metric, setMetric] = useState("percent");
  const [start, end] =
    mode === "week"
      ? [
          startOfWeek(anchor, profile.week_start),
          addDays(startOfWeek(anchor, profile.week_start), 6),
        ]
      : monthBounds(anchor);
  const p = periodSummary(data, start, end, today),
    elapsed = p.days.length;
  const priorStart =
    mode === "week" ? addDays(start, -7) : monthBounds(addDays(start, -1))[0];
  const priorLast =
    mode === "week" ? addDays(priorStart, 6) : monthBounds(priorStart)[1];
  const priorEnd = [
    addDays(priorStart, Math.max(0, elapsed - 1)),
    priorLast,
  ].sort()[0];
  const prev = elapsed
    ? periodSummary(data, priorStart, priorEnd, today)
    : null;
  const chart = dates(start, end).map((date) => {
    const d = daySummary(data, date, today);
    return {
      date,
      label:
        mode === "week" ? pretty(date, { weekday: "short" }) : date.slice(-2),
      percent: date > today ? null : d.percent,
      study:
        date > today
          ? null
          : Math.round(
              data.sessions
                .filter((s) => s.kind === "study")
                .reduce((n, s) => n + sessionMinutes(s, date), 0),
            ),
      meditation:
        date > today
          ? null
          : Math.round(
              data.sessions
                .filter((s) => s.kind === "meditation")
                .reduce((n, s) => n + sessionMinutes(s, date), 0),
            ),
    };
  });
  const rates = data.habits
    .map((h) => {
      const occurrences = p.days.flatMap((d) =>
        d.items.filter((i) => i.habit.id === h.id),
      );
      return {
        h,
        name: versionAt(data.versions, h.id, end)?.name || h.kind,
        total: occurrences.length,
        done: occurrences.filter((i) => i.complete).length,
        rate: occurrences.length
          ? Math.round(
              (occurrences.filter((i) => i.complete).length /
                occurrences.length) *
                100,
            )
          : null,
      };
    })
    .filter((x) => x.total);
  const best = [...rates].sort((a, b) => (b.rate || 0) - (a.rate || 0))[0];
  const weeks = Array.from(
    new Set(p.days.map((d) => startOfWeek(d.date, profile.week_start))),
  ).map((w) => {
    const ds = p.days
      .filter((d) => startOfWeek(d.date, profile.week_start) === w)
      .map((d) => d.date);
    return {
      week: pretty(w, { month: "short", day: "numeric" }),
      study:
        Math.round(
          (data.sessions
            .filter((s) => s.kind === "study")
            .reduce(
              (n, s) => n + ds.reduce((a, d) => a + sessionMinutes(s, d), 0),
              0,
            ) /
            60) *
            10,
        ) / 10,
      meditation: Math.round(
        data.sessions
          .filter((s) => s.kind === "meditation")
          .reduce(
            (n, s) => n + ds.reduce((a, d) => a + sessionMinutes(s, d), 0),
            0,
          ),
      ),
    };
  });
  function shift(n: number) {
    if (mode === "week") setAnchor(addDays(anchor, n * 7));
    else {
      const d = new Date(start + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + n);
      setAnchor(d.toISOString().slice(0, 10));
    }
  }
  const tooltip = {
    contentStyle: {
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      color: "var(--text)",
    },
    labelStyle: { color: "var(--text)" },
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>Small steps. Real growth.</h1>
          <p>See what’s taking root, one week at a time.</p>
        </div>
        <div className="segmented">
          <button
            className={mode === "week" ? "active" : ""}
            onClick={() => setMode("week")}
          >
            Weekly
          </button>
          <button
            className={mode === "month" ? "active" : ""}
            onClick={() => setMode("month")}
          >
            Monthly
          </button>
        </div>
      </div>
      <div className="analytics-controls">
        <div className="date-controls">
          <button
            className="icon-button"
            aria-label="Previous period"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={21} />
          </button>
          <strong>
            {mode === "week"
              ? `${pretty(start, { month: "short", day: "numeric" })} – ${pretty(end, { month: "short", day: "numeric", year: "numeric" })}`
              : pretty(start, { month: "long", year: "numeric" })}
          </strong>
          <button
            className="icon-button"
            aria-label="Next period"
            onClick={() => shift(1)}
          >
            <ChevronRight size={21} />
          </button>
        </div>
        <input
          aria-label={
            mode === "month"
              ? "Select month and year"
              : "Select a date in the week"
          }
          type={mode === "month" ? "month" : "date"}
          value={mode === "month" ? anchor.slice(0, 7) : anchor}
          onChange={(e) =>
            e.target.value &&
            setAnchor(
              mode === "month" ? e.target.value + "-01" : e.target.value,
            )
          }
        />
        <span className="tag">
          {end > today
            ? "Partial period · elapsed days only"
            : "Completed period"}
        </span>
      </div>
      <div className="analytics-metrics">
        <div className="panel">
          <span>Habit completion</span>
          <strong>{p.percent === null ? "—" : p.percent + "%"}</strong>
          <small>
            {p.completed} / {p.scheduled} occurrences
          </small>
        </div>
        <div className="panel">
          <span>Total study</span>
          <strong>{duration(p.study)}</strong>
          <small>Time invested in yourself</small>
        </div>
        <div className="panel">
          <span>Meditation</span>
          <strong>
            {Math.floor(p.meditation)}
            <em> min</em>
          </strong>
          <small>Room to breathe</small>
        </div>
        <div className="panel">
          <span>Successful days</span>
          <strong>
            {p.successes}
            <em> / {p.days.filter((d) => d.total).length}</em>
          </strong>
          <small>All scheduled habits complete</small>
        </div>
      </div>
      <section className="panel analytics-chart">
        <div className="section-heading">
          <div>
            <h2>Your daily rhythm</h2>
            <p>
              {metric === "percent"
                ? "Completed scheduled habits, as a percentage."
                : "Completed sessions, in minutes."}
            </p>
          </div>
          <select
            aria-label="Chart measure"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="percent">Habit completion (%)</option>
            <option value="study">Study (minutes)</option>
            <option value="meditation">Meditation (minutes)</option>
          </select>
        </div>
        {!p.scheduled && !p.study && !p.meditation ? (
          <Empty title="A fresh page for your progress">
            <p>Log your first day to see your rhythm take shape.</p>
          </Empty>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            {mode === "week" ? (
              <BarChart
                data={chart}
                margin={{ left: -15, right: 10, top: 20, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <YAxis
                  domain={metric === "percent" ? [0, 100] : [0, "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <Tooltip
                  {...tooltip}
                  cursor={{ fill: "var(--soft)" }}
                  labelFormatter={(_, p) => p[0]?.payload.date}
                  formatter={(v) => [
                    `${v}${metric === "percent" ? "%" : " min"}`,
                    metric === "percent" ? "Habits complete" : metric,
                  ]}
                />
                <Bar
                  dataKey={metric}
                  fill="#7f9f82"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            ) : (
              <LineChart
                data={chart}
                margin={{ left: -15, right: 10, top: 20, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <YAxis
                  domain={metric === "percent" ? [0, 100] : [0, "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <Tooltip
                  {...tooltip}
                  labelFormatter={(_, p) => p[0]?.payload.date}
                />
                <Line
                  dataKey={metric}
                  stroke="#7f9f82"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </section>
      <div className="analytics-two">
        <section className="panel">
          <h2>A closer look</h2>
          {[
            ["Completed occurrences", p.completed],
            ["Incomplete occurrences", p.missed],
            ["Most consistent habit", best?.name || "—"],
            [
              "Longest streak in period",
              longestStreak(data, start, end, today) + " days",
            ],
          ].map(([label, value]) => (
            <div className="insight-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <p className="small muted">
            Incomplete occurrences include unfinished goals today. Future dates
            are excluded.
          </p>
          <div className="comparison">
            <span>
              Compared with{" "}
              {prev
                ? `${pretty(priorStart, { month: "short", day: "numeric" })} – ${pretty(priorEnd, { month: "short", day: "numeric" })}`
                : "previous period"}
            </span>
            <strong>
              {p.percent !== null &&
              prev?.percent !== null &&
              prev?.percent !== undefined
                ? `${p.percent - prev.percent >= 0 ? "+" : ""}${p.percent - prev.percent} percentage points`
                : "Not enough records to compare"}
            </strong>
            <small>
              {elapsed} elapsed days; previous comparison capped to the same
              number of days.
            </small>
          </div>
        </section>
        <section className="panel">
          <h2>Habit by habit</h2>
          <p className="muted small">
            Completed occurrences / scheduled occurrences.
          </p>
          {!rates.length ? (
            <p className="muted">No scheduled habits in this period.</p>
          ) : (
            rates.map((r) => (
              <div className="habit-rate" key={r.h.id}>
                <div>
                  <span>{r.name}</span>
                  <strong>
                    {r.done}/{r.total} · {r.rate}%
                  </strong>
                </div>
                <Progress percent={r.rate || 0} />
              </div>
            ))
          )}
        </section>
      </div>
      {mode === "month" && (
        <>
          <section className="panel heatmap-panel">
            <div className="section-heading">
              <div>
                <h2>A month of showing up</h2>
                <p>
                  Each square is a day. Select a day in Calendar to review it.
                </p>
              </div>
            </div>
            <div className="heatmap">
              {chart.map((x) => {
                const d = daySummary(data, x.date, today);
                return (
                  <div
                    key={x.date}
                    tabIndex={0}
                    title={`${x.date}: ${d.status}, ${d.percent ?? "no"}%`}
                    className={`heat-day ${d.status}`}
                    aria-label={`${x.date}: ${d.status}, ${d.percent === null ? "no habits scheduled" : d.percent + " percent"}`}
                  >
                    <span>{Number(x.date.slice(-2))}</span>
                    <small>
                      {d.status === "future"
                        ? "—"
                        : d.percent === null
                          ? "Rest"
                          : d.percent + "%"}
                    </small>
                  </div>
                );
              })}
            </div>
            <Legend />
          </section>
          <div className="analytics-two">
            {(["study", "meditation"] as const).map((kind) => (
              <section className="panel" key={kind}>
                <h2>
                  {kind === "study" ? "Study hours" : "Meditation minutes"} by
                  week
                </h2>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart
                    data={weeks}
                    margin={{ left: -20, right: 10, top: 20 }}
                  >
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip {...tooltip} />
                    <Bar
                      dataKey={kind}
                      fill={kind === "study" ? "#8fa7be" : "#91aa8b"}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            ))}
          </div>
        </>
      )}
      <p className="calculation-note">
        A successful day means all scheduled habits are complete. Rest days
        neither extend nor break streaks. A day in progress does not break your
        current streak. Tasks are counted separately.
      </p>
    </>
  );
}
