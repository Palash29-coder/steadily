import { useState } from "react";
import { useStore } from "./store";
import {
  type Habit,
  type Version,
  type Session,
  type Task,
  type Journal,
  uid,
  type RecordRow,
} from "./model";
import { baseVersion } from "./api";
import { addDays, localDate, versionAt, sessionMinutes } from "./core";
import { Field, SaveForm, str, num } from "./components";
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function Weekdays({
  selected = [1, 2, 3, 4, 5],
}: {
  selected?: number[];
}) {
  return (
    <fieldset className="weekdays">
      <legend>On these weekdays</legend>
      {days.map((d, i) => (
        <label key={d}>
          <input
            type="checkbox"
            name={`day${i}`}
            defaultChecked={selected.includes(i)}
          />
          <span>{d}</span>
        </label>
      ))}
    </fieldset>
  );
}
const selectedDays = (f: FormData) =>
  days.map((_, i) => i).filter((i) => f.has(`day${i}`));
export function HabitForm({
  habit,
  onDone,
}: {
  habit?: Habit;
  onDone: () => void;
}) {
  const { profile, data, save, demo } = useStore();
  const today = localDate(new Date(), profile.timezone);
  const v = habit
    ? versionAt(data.versions, habit.id, addDays(today, 1))
    : undefined;
  const [tracking, setTracking] = useState(v?.tracking || "checkbox");
  const [recurrence, setRecurrence] = useState(v?.recurrence || "daily");
  const [existingId] = useState(() => habit?.id || uid());
  const [created, setCreated] = useState(!!habit);
  const who = demo ? "demo" : profile.user_id;
  return (
    <SaveForm
      draftKey={`habit-${habit?.id || "new"}`}
      onRecover={(d) => {
        if (d.tracking) setTracking(d.tracking);
        if (d.recurrence) setRecurrence(d.recurrence);
      }}
      onDone={onDone}
      button={habit ? "Save habit" : "Create habit"}
      onSave={async (f) => {
        const effective = str(f, "effective_from") || today;
        const start = str(f, "start_date");
        const end = str(f, "end_date") || null;
        const week = selectedDays(f);
        if (str(f, "recurrence") === "weekdays" && !week.length)
          throw new Error("Choose at least one weekday.");
        if (end && end < start)
          throw new Error("End date must follow the start date.");
        const old = data.versions.find(
          (x) => x.habit_id === existingId && x.effective_from === effective,
        );
        const next: Version = {
          ...(v || baseVersion(existingId, today, who)),
          id: old?.id || uid(),
          habit_id: existingId,
          user_id: who,
          effective_from: effective,
          name: str(f, "name"),
          description: str(f, "description"),
          category: str(f, "category"),
          icon: str(f, "icon"),
          color: str(f, "color"),
          tracking: str(f, "tracking") as Version["tracking"],
          target: Math.max(1, num(f, "target")),
          unit: str(f, "unit"),
          wake_start: str(f, "wake_start") || "06:30",
          wake_end: str(f, "wake_end") || "07:00",
          early_ok: f.has("early_ok"),
          recurrence: str(f, "recurrence") as Version["recurrence"],
          weekdays: week,
          start_date: start,
          end_date: end,
          reminder: str(f, "reminder"),
          skill_rule:
            (str(f, "skill_rule") as Version["skill_rule"]) || "session",
          archived: f.has("archived"),
        };
        if (!created) {
          await save("habits", {
            id: existingId,
            user_id: who,
            kind: "custom",
            position: data.habits.length,
            created_at: new Date().toISOString(),
          });
          setCreated(true);
        }
        await save("versions", next, "habit_id,effective_from");
      }}
    >
      {habit && (
        <p className="notice">
          Changes start on the effective date. Earlier targets and scores stay
          intact.
        </p>
      )}
      <div className="form-grid">
        <Field label="Habit name">
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={v?.name}
            placeholder="e.g. Read a few pages"
          />
        </Field>
        <Field label="Category">
          <input
            name="category"
            defaultValue={v?.category || "Personal"}
            required
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={2} defaultValue={v?.description} />
      </Field>
      <div className="form-grid">
        <Field label="Tracking type">
          <select
            name="tracking"
            value={tracking}
            onChange={(e) => setTracking(e.target.value as Version["tracking"])}
            disabled={!!habit && habit.kind !== "custom"}
          >
            {[
              ["checkbox", "Check off"],
              ["duration", "Duration"],
              ["count", "Numeric count"],
              ["window", "Time window"],
            ].map(([x, n]) => (
              <option value={x} key={x}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {habit && habit.kind !== "custom" && (
          <input type="hidden" name="tracking" value={tracking} />
        )}
        <Field label="Icon">
          <select name="icon" defaultValue={v?.icon || "spark"}>
            {[
              "spark",
              "wake",
              "study",
              "skill",
              "meditation",
              "count",
              "clock",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Target value">
          <input
            type="number"
            name="target"
            min="1"
            max="100000"
            required
            defaultValue={v?.target || 1}
          />
        </Field>
        <Field label="Unit">
          <input
            name="unit"
            defaultValue={v?.unit || "times"}
            placeholder="min, pages, glasses…"
          />
        </Field>
      </div>
      <p className="muted small">
        Duration targets use minutes. Checkbox targets are complete when
        checked.
      </p>
      {habit?.kind === "skill" && (
        <Field label="Skill completion rule">
          <select name="skill_rule" defaultValue={v?.skill_rule}>
            <option value="session">At least one session</option>
            <option value="minutes">Reach the target minutes</option>
          </select>
        </Field>
      )}
      <div
        className={`form-grid ${tracking !== "window" ? "hidden-fields" : ""}`}
      >
        <Field label="Window start">
          <input
            type="time"
            name="wake_start"
            defaultValue={v?.wake_start || "06:30"}
          />
        </Field>
        <Field label="Window end">
          <input
            type="time"
            name="wake_end"
            defaultValue={v?.wake_end || "07:00"}
          />
        </Field>
      </div>
      {tracking === "window" && (
        <label className="check-line">
          <input type="checkbox" name="early_ok" defaultChecked={v?.early_ok} />{" "}
          Also count earlier times (for a same-day window)
        </label>
      )}
      <div className="form-grid">
        <Field label="Repeat">
          <select
            name="recurrence"
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as Version["recurrence"])
            }
          >
            <option value="daily">Every day</option>
            <option value="weekdays">Selected weekdays</option>
            <option value="once">One time</option>
          </select>
        </Field>
        <Field label="Accent color">
          <select name="color" defaultValue={v?.color || "green"}>
            {["green", "blue", "purple", "amber", "rose"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className={recurrence !== "weekdays" ? "hidden-fields" : ""}>
        <Weekdays selected={v?.weekdays} />
      </div>
      <div className="form-grid">
        <Field label="Start date">
          <input
            name="start_date"
            type="date"
            required
            defaultValue={v?.start_date || today}
          />
        </Field>
        <Field label="End date (optional)">
          <input name="end_date" type="date" defaultValue={v?.end_date || ""} />
        </Field>
      </div>
      {habit && (
        <Field label="Changes effective from">
          <input
            name="effective_from"
            type="date"
            min={today}
            required
            defaultValue={addDays(today, 1)}
          />
        </Field>
      )}
      <Field
        label="Reminder note (optional)"
        hint="A personal note only. Closed-site notifications are not delivered."
      >
        <input
          name="reminder"
          defaultValue={v?.reminder}
          placeholder="e.g. After breakfast"
        />
      </Field>
      {habit && (
        <label className="check-line">
          <input name="archived" type="checkbox" defaultChecked={v?.archived} />{" "}
          Archive from the effective date (uncheck to restore)
        </label>
      )}
    </SaveForm>
  );
}
export function RecordForm({
  habit,
  version,
  date,
  onDone,
}: {
  habit: Habit;
  version: Version;
  date: string;
  onDone: () => void;
}) {
  const { data, profile, save, demo } = useStore();
  const r = data.records.find(
    (r) => r.habit_id === habit.id && r.date === date,
  );
  const [id] = useState(() => r?.id || uid());
  return (
    <SaveForm
      draftKey={`record-${habit.id}-${date}`}
      onDone={onDone}
      button="Save entry"
      onSave={async (f) => {
        const row: RecordRow = {
          id,
          user_id: demo ? "demo" : profile.user_id,
          habit_id: habit.id,
          date,
          value: num(f, "value"),
          checked: f.has("checked"),
          time: str(f, "time"),
          title: str(f, "title"),
          source: str(f, "source"),
          takeaway: str(f, "takeaway"),
          reflection: str(f, "reflection"),
          notes: str(f, "notes"),
        };
        await save("records", row, "habit_id,date");
      }}
    >
      <p className="muted">Logging for {date}</p>
      {version.tracking === "window" ? (
        <>
          <Field
            label={
              habit.kind === "wake" ? "Actual wake-up time" : "Recorded time"
            }
          >
            <input
              type="time"
              name="time"
              required
              defaultValue={r?.time || ""}
            />
          </Field>
          <p className="notice">
            Your window is {version.wake_start}–{version.wake_end}, including
            both endpoints.{" "}
            {version.early_ok
              ? "Earlier times count too."
              : "Earlier times are recorded as before the window and do not complete this goal."}
          </p>
        </>
      ) : version.tracking === "checkbox" ? (
        <label className="check-line">
          <input
            name="checked"
            type="checkbox"
            defaultChecked={r?.checked ?? true}
          />{" "}
          Completed {version.name.toLowerCase()}
        </label>
      ) : (
        <Field
          label={`Total ${version.tracking === "duration" ? "minutes" : version.unit || "count"} for this day`}
        >
          <input
            name="value"
            type="number"
            min="0"
            step="0.1"
            required
            defaultValue={r?.value || 0}
          />
        </Field>
      )}
      {habit.kind === "growth" && (
        <>
          <Field label="Lesson title">
            <input
              name="title"
              defaultValue={r?.title}
              placeholder="What did you explore?"
            />
          </Field>
          <Field label="Source or link">
            <input
              name="source"
              defaultValue={r?.source}
              placeholder="Book, podcast, or https://…"
            />
          </Field>
          <Field label="Key takeaway">
            <textarea name="takeaway" defaultValue={r?.takeaway} rows={3} />
          </Field>
          <Field label="Reflection (optional)">
            <textarea name="reflection" defaultValue={r?.reflection} rows={2} />
          </Field>
        </>
      )}
      <Field label="Notes (optional)">
        <textarea name="notes" defaultValue={r?.notes} rows={2} />
      </Field>
    </SaveForm>
  );
}
export function SessionForm({
  kind,
  date,
  session,
  onDone,
}: {
  kind: Session["kind"];
  date: string;
  session?: Session;
  onDone: () => void;
}) {
  const { save, profile, demo } = useStore();
  const [id] = useState(() => session?.id || uid());
  return (
    <SaveForm
      draftKey={`session-${session?.id || kind + "-" + date}`}
      onDone={onDone}
      button={session ? "Save correction" : "Log session"}
      onSave={async (f) => {
        const minutes = num(f, "minutes");
        if (minutes <= 0)
          throw new Error("Enter a duration greater than zero.");
        await save("sessions", {
          id,
          user_id: demo ? "demo" : profile.user_id,
          kind,
          date: str(f, "date"),
          timezone: profile.timezone,
          label: str(f, "label"),
          notes: str(f, "notes"),
          minutes,
          segments: [],
          running_since: null,
          state: "finished",
          created_at: session?.created_at || new Date().toISOString(),
        });
      }}
    >
      {session?.segments.length ? (
        <p className="notice">
          This correction replaces the timer’s intervals with a manual duration
          assigned to the selected date.
        </p>
      ) : null}
      <div className="form-grid">
        <Field label="Date">
          <input
            type="date"
            name="date"
            required
            max={localDate(new Date(), profile.timezone)}
            defaultValue={date}
          />
        </Field>
        <Field label="Duration (minutes)">
          <input
            name="minutes"
            type="number"
            min="0.1"
            step="0.1"
            max="1440"
            required
            defaultValue={
              session
                ? Math.round(
                    session.segments.length
                      ? session.segments.reduce(
                          (n, p) =>
                            n +
                            (Date.parse(p.end) - Date.parse(p.start)) / 60000,
                          0,
                        )
                      : session.minutes,
                  )
                : undefined
            }
            placeholder="30"
          />
        </Field>
      </div>
      <Field
        label={
          kind === "skill"
            ? "Skill name"
            : kind === "study"
              ? "Subject or topic"
              : "Session label"
        }
      >
        <input
          name="label"
          required
          defaultValue={session?.label}
          placeholder={
            kind === "skill"
              ? "e.g. Sketching"
              : kind === "study"
                ? "e.g. Mathematics"
                : "e.g. Mindful breathing"
          }
        />
      </Field>
      <Field
        label={kind === "skill" ? "What did you learn?" : "Notes (optional)"}
      >
        <textarea name="notes" rows={3} defaultValue={session?.notes} />
      </Field>
    </SaveForm>
  );
}
export function TaskForm({
  date,
  task,
  onDone,
}: {
  date: string;
  task?: Task;
  onDone: () => void;
}) {
  const { save, profile, demo } = useStore();
  const [id] = useState(() => task?.id || uid());
  return (
    <SaveForm
      draftKey={`task-${task?.id || "new"}`}
      onDone={onDone}
      button={task ? "Save task" : "Add task"}
      onSave={async (f) => {
        const recurrence = str(f, "recurrence") as Task["recurrence"];
        const weekdays = selectedDays(f);
        if (recurrence === "weekdays" && !weekdays.length)
          throw new Error("Choose at least one weekday.");
        await save("tasks", {
          id,
          user_id: demo ? "demo" : profile.user_id,
          title: str(f, "title"),
          description: str(f, "description"),
          date: str(f, "date"),
          priority: str(f, "priority"),
          category: str(f, "category"),
          notes: str(f, "notes"),
          recurrence,
          weekdays,
          end_date: str(f, "end_date") || null,
          completed_dates: task?.completed_dates || [],
          subtasks: str(f, "subtasks")
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((title) => ({
              title,
              completed_dates:
                task?.subtasks.find((s) => s.title === title)
                  ?.completed_dates || [],
            })),
        });
      }}
    >
      <Field label="Task title">
        <input
          name="title"
          required
          maxLength={150}
          defaultValue={task?.title}
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={2}
          defaultValue={task?.description}
        />
      </Field>
      <div className="form-grid">
        <Field label="Due / start date">
          <input
            type="date"
            name="date"
            required
            defaultValue={task?.date || date}
          />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={task?.priority || "Medium"}>
            {["Low", "Medium", "High"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <input name="category" defaultValue={task?.category || "Personal"} />
        </Field>
        <Field label="Recurrence">
          <select name="recurrence" defaultValue={task?.recurrence || "once"}>
            <option value="once">One time</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Selected weekdays</option>
          </select>
        </Field>
      </div>
      <Weekdays selected={task?.weekdays} />
      <Field label="End date (optional)">
        <input
          name="end_date"
          type="date"
          defaultValue={task?.end_date || ""}
        />
      </Field>
      <Field
        label="Subtasks"
        hint="One subtask per line. Completion is tracked for each occurrence."
      >
        <textarea
          name="subtasks"
          rows={3}
          defaultValue={task?.subtasks.map((x) => x.title).join("\n")}
        />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={task?.notes} />
      </Field>
    </SaveForm>
  );
}
export function JournalForm({
  date,
  onDone,
}: {
  date: string;
  onDone: () => void;
}) {
  const { data, save, profile, demo } = useStore();
  const j = data.journals.find((x) => x.date === date);
  const [id] = useState(() => j?.id || uid());
  return (
    <SaveForm
      draftKey={`journal-${date}`}
      onDone={onDone}
      button="Save reflection"
      onSave={async (f) => {
        const row: Journal = {
          id,
          user_id: demo ? "demo" : profile.user_id,
          date,
          mood: str(f, "mood"),
          went_well: str(f, "went_well"),
          learned: str(f, "learned"),
          improve: str(f, "improve"),
        };
        await save("journals", row, "user_id,date");
      }}
    >
      <Field label="How are you feeling?">
        <select name="mood" defaultValue={j?.mood || ""}>
          <option value="">Choose a mood</option>
          {["Energized", "Good", "Okay", "Low", "Tired"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      {[
        ["went_well", "What went well?"],
        ["learned", "What did you learn?"],
        ["improve", "What would you like to improve tomorrow?"],
      ].map(([name, label]) => (
        <Field key={name} label={label}>
          <textarea
            name={name}
            rows={3}
            defaultValue={j?.[name as keyof Journal] || ""}
          />
        </Field>
      ))}
    </SaveForm>
  );
}
