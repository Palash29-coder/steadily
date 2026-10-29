import { useState } from "react";
import {
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Download,
  RefreshCw,
} from "lucide-react";
import { useStore } from "./store";
import { type Profile } from "./model";
import {
  addDays,
  localDate,
  versionAt,
  dates,
  daySummary,
  sessionMinutes,
} from "./core";
import { Button, Empty, Icon, Field, SaveForm, str } from "./components";
import { type Dialog } from "./Dashboard";
export function Habits({ onDialog }: { onDialog: (d: Dialog) => void }) {
  const { data, profile, save } = useStore(),
    today = localDate(new Date(), profile.timezone);
  const [archived, setArchived] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const habits = [...data.habits]
    .sort((a, b) => a.position - b.position)
    .filter((h) => {
      const v = versionAt(data.versions, h.id, addDays(today, 1));
      return v ? v.archived === archived : !archived;
    });
  async function move(id: string, n: number) {
    const sorted = [...data.habits].sort((a, b) => a.position - b.position),
      i = sorted.findIndex((h) => h.id === id),
      other = sorted[i + n];
    if (!other) return;
    setBusy(true);
    setErr("");
    try {
      await save("habits", { ...sorted[i], position: other.position });
      await save("habits", { ...other, position: sorted[i].position });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILD A LIFE THAT FEELS LIKE YOU</span>
          <h1>Your habits, your way.</h1>
          <p>Choose a few intentions. Give them time to take root.</p>
        </div>
        <Button onClick={() => onDialog({ type: "habit" })}>
          <Plus size={17} />
          Add habit
        </Button>
      </div>
      <div className="segmented fit">
        <button
          className={!archived ? "active" : ""}
          onClick={() => setArchived(false)}
        >
          Active habits
        </button>
        <button
          className={archived ? "active" : ""}
          onClick={() => setArchived(true)}
        >
          Archived & scheduled archives
        </button>
      </div>
      <p className="muted small">
        Changes start tomorrow by default. Open a habit to choose an effective
        date, archive, or restore it.
      </p>
      {err && <p className="error">{err}</p>}
      <div className="habit-management">
        {habits.map((h) => {
          const v = versionAt(data.versions, h.id, addDays(today, 1));
          if (!v)
            return (
              <section className="panel" key={h.id}>
                <p>Finish setting up this habit.</p>
                <Button
                  variant="secondary"
                  onClick={() => onDialog({ type: "habit", habit: h })}
                >
                  Continue setup
                </Button>
              </section>
            );
          return (
            <section className="panel habit-manage-row" key={h.id}>
              <span className={`icon-tile ${v.color}`}>
                <Icon name={v.icon} />
              </span>
              <div className="habit-manage-copy">
                <h3>{v.name}</h3>
                <p>
                  {v.category} ·{" "}
                  {v.recurrence === "daily"
                    ? "Every day"
                    : v.recurrence === "once"
                      ? "One time"
                      : "Selected weekdays"}{" "}
                  ·{" "}
                  {v.tracking === "window"
                    ? `${v.wake_start}–${v.wake_end}`
                    : v.tracking === "checkbox"
                      ? "Check off"
                      : h.kind === "skill" && v.skill_rule === "session"
                        ? "One practice session"
                        : `${v.target} ${v.unit}`}
                </p>
                {v.description && <p>{v.description}</p>}
                <small>
                  {v.effective_from > today
                    ? `Update scheduled for ${v.effective_from}`
                    : v.archived
                      ? "Archived · history preserved"
                      : "A little consistency goes a long way"}
                </small>
              </div>
              <div className="row-actions">
                <button
                  disabled={busy}
                  className="icon-button"
                  aria-label={`Move ${v.name} up`}
                  onClick={() => move(h.id, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  disabled={busy}
                  className="icon-button"
                  aria-label={`Move ${v.name} down`}
                  onClick={() => move(h.id, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <Button
                  variant="secondary"
                  onClick={() => onDialog({ type: "habit", habit: h })}
                >
                  {archived ? <RefreshCw size={14} /> : <Pencil size={14} />}
                  {archived ? "Restore / edit" : "Edit"}
                </Button>
              </div>
            </section>
          );
        })}
        {!habits.length && (
          <Empty
            title={
              archived ? "No archived habits" : "Your next chapter starts here"
            }
          >
            <p>
              {archived
                ? "Archived habits keep their history."
                : "Add a habit that matters to you."}
            </p>
          </Empty>
        )}
      </div>
      <section className="info-card">
        <Icon name="skill" size={25} />
        <div>
          <h3>Make progress on your terms.</h3>
          <p>
            Your daily score only includes habits scheduled for that day. Target
            and schedule changes preserve earlier scores. Archive a habit
            whenever you need a little space.
          </p>
        </div>
      </section>
    </>
  );
}
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Settings({ onDialog }: { onDialog: (d: Dialog) => void }) {
  const { profile, saveProfile, data, demo, resetDemo } = useStore();
  const [confirm, setConfirm] = useState(false),
    [saved, setSaved] = useState(false);
  const today = localDate(new Date(), profile.timezone);
  function exportData(format: string) {
    const first = data.versions.map((v) => v.start_date).sort()[0] || today;
    const summaries = dates(first, today).map((d) => {
      const s = daySummary(data, d, today);
      return {
        date: d,
        scheduled: s.total,
        completed: s.completed,
        percent: s.percent,
        status: s.status,
        study_minutes: data.sessions
          .filter((s) => s.kind === "study")
          .reduce((n, s) => n + sessionMinutes(s, d), 0),
        meditation_minutes: data.sessions
          .filter((s) => s.kind === "meditation")
          .reduce((n, s) => n + sessionMinutes(s, d), 0),
      };
    });
    if (format === "json")
      download(
        `steadily-${today}.json`,
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            timezone: profile.timezone,
            demo,
            profile,
            data,
            summaries,
          },
          null,
          2,
        ),
        "application/json",
      );
    else {
      const csv = (value: unknown) => {
        let s =
          typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "");
        if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const lines = [
        ["record_type", "date", "id", "data_json"].map(csv).join(","),
      ];
      for (const [type, rows] of Object.entries({
        ...data,
        summaries,
        profile: [profile],
      }))
        for (const row of rows as any[])
          lines.push(
            [
              type,
              row.date || row.effective_from || "",
              row.id || row.user_id || "",
              row,
            ]
              .map(csv)
              .join(","),
          );
      download(
        `steadily-${today}.csv`,
        lines.join("\r\n"),
        "text/csv;charset=utf-8",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>A space that fits you.</h1>
          <p>A few preferences to help your days flow a little easier.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Your personal space</h2>
          <SaveForm
            draftKey="settings"
            onDone={() => setSaved(true)}
            onSave={async (f) => {
              const timezone = str(f, "timezone");
              try {
                new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
              } catch {
                throw new Error("Enter a valid timezone such as Asia/Kolkata.");
              }
              await saveProfile({
                ...profile,
                name: str(f, "name"),
                timezone,
                week_start: Number(f.get("week_start")),
                theme: str(f, "theme") as Profile["theme"],
                reminders: f.has("reminders"),
              });
            }}
          >
            <Field label="Display name">
              <input
                name="name"
                maxLength={80}
                defaultValue={profile.name}
                placeholder="What should we call you?"
              />
            </Field>
            <Field
              label="Timezone"
              hint="New timer sessions use this timezone. Existing timer sessions keep their original timezone and day boundaries."
            >
              <input
                name="timezone"
                list="timezones"
                required
                defaultValue={profile.timezone}
              />
              <datalist id="timezones">
                {[
                  "Asia/Kolkata",
                  "UTC",
                  "Europe/London",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Asia/Tokyo",
                  "Australia/Sydney",
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </datalist>
            </Field>
            <div className="form-grid">
              <Field label="Week starts on">
                <select name="week_start" defaultValue={profile.week_start}>
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((d, i) => (
                    <option value={i} key={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Appearance">
                <select name="theme" defaultValue={profile.theme}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </Field>
            </div>
            <label className="check-line">
              <input
                type="checkbox"
                name="reminders"
                defaultChecked={profile.reminders}
              />{" "}
              Show habit reminder notes
            </label>
            <p className="small muted">
              Reminder notes appear in the app. Email, push, and notifications
              while the website is closed are not enabled.
            </p>
            {saved && (
              <p className="positive" role="status">
                Your preferences are saved.
              </p>
            )}
          </SaveForm>
        </section>
        <div>
          <section className="panel">
            <h2>Your daily targets</h2>
            <p className="muted small">
              Edit a goal and choose when the change starts. Earlier days stay
              exactly as they were.
            </p>
            {data.habits
              .filter((h) =>
                ["wake", "study", "meditation", "skill"].includes(h.kind),
              )
              .map((h) => {
                const v = versionAt(data.versions, h.id, addDays(today, 1));
                return (
                  <div className="setting-target" key={h.id}>
                    <span
                      className={`icon-tile compact ${v?.color || "green"}`}
                    >
                      <Icon name={h.kind} />
                    </span>
                    <div>
                      <strong>{v?.name || h.kind}</strong>
                      <small>
                        {h.kind === "wake"
                          ? `${v?.wake_start}–${v?.wake_end}${v?.early_ok ? " · earlier counts" : ""}`
                          : h.kind === "skill" && v?.skill_rule === "session"
                            ? "One practice session"
                            : `${v?.target} minutes`}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => onDialog({ type: "habit", habit: h })}
                    >
                      Edit
                      <Pencil size={14} />
                    </button>
                  </div>
                );
              })}
          </section>
          <section className="panel export-panel">
            <span className="icon-tile green">
              <Download size={21} />
            </span>
            <h2>Your progress belongs to you.</h2>
            <p>
              Download all your records, habit versions, sessions, tasks,
              reflections, and daily summaries. Duration units are minutes;
              timestamps use ISO 8601.
            </p>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => exportData("csv")}>
                Export CSV
                <Download size={14} />
              </Button>
              <Button variant="secondary" onClick={() => exportData("json")}>
                Export JSON
                <Download size={14} />
              </Button>
            </div>
          </section>
          {demo && (
            <section className="panel">
              <h3>Demo workspace</h3>
              <p className="muted">
                Sample records stay in this browser and never mix with an
                account.
              </p>
              {confirm ? (
                <>
                  <p>This clears all demo records, including edits you made.</p>
                  <Button
                    variant="danger"
                    onClick={() => {
                      resetDemo();
                      setConfirm(false);
                    }}
                  >
                    Clear demo records
                  </Button>{" "}
                  <Button variant="secondary" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setConfirm(true)}>
                  Remove all demo data
                </Button>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
