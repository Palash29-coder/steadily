import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Check } from "lucide-react";
import { useStore } from "./store";
import {
  localDate,
  monthBounds,
  startOfWeek,
  dates,
  addDays,
  daySummary,
  pretty,
} from "./core";
import { Button } from "./components";
import { HabitCards, Tasks, SessionList, type Dialog } from "./Dashboard";
export function Calendar({ onDialog }: { onDialog: (d: Dialog) => void }) {
  const { data, profile } = useStore(),
    today = localDate(new Date(), profile.timezone);
  const [selected, setSelected] = useState(today),
    [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const [start, end] = monthBounds(month),
    gridStart = startOfWeek(start, profile.week_start),
    count = Math.ceil(dates(gridStart, end).length / 7) * 7;
  const selectedDay = daySummary(data, selected, today),
    journal = data.journals.find((j) => j.date === selected);
  function shift(n: number) {
    const d = new Date(month + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 10));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A RECORD OF SHOWING UP</span>
          <h1>Your days, in perspective.</h1>
          <p>Look back with kindness. There’s always room to begin again.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setMonth(today.slice(0, 7) + "-01");
            setSelected(today);
          }}
        >
          Back to today
        </Button>
      </div>
      <section className="panel calendar-panel">
        <div className="section-heading">
          <h2>{pretty(month, { month: "long", year: "numeric" })}</h2>
          <div className="date-controls">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <input
              type="month"
              aria-label="Calendar month"
              value={month.slice(0, 7)}
              onChange={(e) =>
                e.target.value && setMonth(e.target.value + "-01")
              }
            />
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="weekday-label">
              {pretty(addDays(gridStart, i), { weekday: "short" })}
            </span>
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = addDays(gridStart, i),
              s = daySummary(data, date, today);
            return (
              <button
                aria-label={`${date}: ${s.status}, ${s.percent ?? "no"} percent`}
                aria-pressed={selected === date}
                key={date}
                className={`calendar-day ${date.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""} ${date === today ? "is-today" : ""} ${selected === date ? "selected" : ""} ${s.status}`}
                onClick={() => setSelected(date)}
              >
                <span>{Number(date.slice(-2))}</span>
                <small>
                  {s.status === "future"
                    ? "Upcoming"
                    : s.percent === null
                      ? "Rest day"
                      : s.status === "unlogged"
                        ? "Unlogged"
                        : `${s.percent}%`}
                </small>
                {s.status === "success" && <Check size={13} />}
              </button>
            );
          })}
        </div>
        <Legend />
      </section>
      <div className="section-heading history-heading">
        <div>
          <span className="eyebrow">YOUR DAILY NOTEBOOK</span>
          <h2>
            {pretty(selected, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
          <p>
            {selected > today
              ? "A little space for the days ahead."
              : `${selectedDay.completed} of ${selectedDay.total} scheduled habits complete. Past entries can be corrected here.`}
          </p>
        </div>
        {selected <= today && (
          <Button
            variant="secondary"
            onClick={() => onDialog({ type: "quick", date: selected })}
          >
            <Plus size={16} />
            Add entry
          </Button>
        )}
      </div>
      <HabitCards date={selected} onDialog={onDialog} />
      {selectedDay.items
        .filter(
          (i) =>
            i.record &&
            (i.record.takeaway ||
              i.record.notes ||
              i.record.reflection ||
              i.record.source),
        )
        .map((i) => (
          <section className="panel lesson-detail" key={i.habit.id}>
            <h3>{i.record!.title || i.version.name}</h3>
            {i.record!.source && (
              <p className="small muted">Source: {i.record!.source}</p>
            )}
            {[i.record!.takeaway, i.record!.reflection, i.record!.notes]
              .filter(Boolean)
              .map((text, n) => (
                <p key={n}>{text}</p>
              ))}
          </section>
        ))}
      <div className="history-columns">
        <div>
          <SessionList date={selected} onDialog={onDialog} />
          <Tasks date={selected} onDialog={onDialog} />
        </div>
        <section className="panel journal-preview">
          <span className="eyebrow">PAUSE & REFLECT</span>
          <h2>A note to yourself</h2>
          {journal ? (
            <>
              {journal.mood && (
                <span className="tag">
                  Feeling {journal.mood.toLowerCase()}
                </span>
              )}
              {[
                ["went_well", "What went well"],
                ["learned", "What I learned"],
                ["improve", "A little intention for tomorrow"],
              ].map(([key, label]) => (
                <div key={key}>
                  <h4>{label}</h4>
                  <p>{journal[key as keyof typeof journal] || "—"}</p>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">
              What’s one thing you want to remember about this day?
            </p>
          )}
          {selected <= today && (
            <Button
              variant="secondary"
              onClick={() => onDialog({ type: "journal", date: selected })}
            >
              <Pencil size={15} />
              {journal ? "Edit reflection" : "Write a reflection"}
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
export function Legend() {
  return (
    <div className="calendar-legend">
      <span>
        <i className="success" /> All complete
      </span>
      <span>
        <i className="partial" /> Some progress
      </span>
      <span>
        <i className="unlogged" /> Unlogged
      </span>
      <span>
        <i className="future" /> Upcoming
      </span>
    </div>
  );
}
