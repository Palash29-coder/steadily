import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  X,
  Sun,
  BookOpen,
  Sparkles,
  Sprout,
  Wind,
  Check,
  Plus,
  Clock,
  Hash,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "./store";
export const icons = {
  wake: Sun,
  study: BookOpen,
  growth: Sparkles,
  skill: Sprout,
  meditation: Wind,
  custom: Check,
  spark: Sparkles,
  clock: Clock,
  count: Hash,
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const C = icons[name as keyof typeof icons] || Sparkles;
  return <C size={size} strokeWidth={1.7} />;
}
export function Button({
  children,
  onClick,
  variant = "",
  type = "button",
  disabled = false,
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  [key: string]: any;
}) {
  return (
    <button
      type={type}
      className={`button ${variant}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sprout size={25} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Progress({
  percent,
  color = "green",
}: {
  percent: number;
  color?: string;
}) {
  return (
    <div
      className={`progress ${color}`}
      role="progressbar"
      aria-label="Goal progress"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}
export function Ring({
  percent,
  size = 112,
}: {
  percent: number;
  size?: number;
}) {
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r="51"
          className="ring-fill"
          strokeDasharray={`${percent * 3.2044} 320.44`}
        />
      </svg>
      <div>
        <strong>
          {percent}
          <sup>%</sup>
        </strong>
        <span>complete</span>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        ref.current!.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        ),
      ).filter((e) => !e.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusable(),
          first = f[0],
          last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">A LITTLE INTENTION</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function SaveForm({
  children,
  onSave,
  onDone,
  draftKey,
  button = "Save changes",
  onRecover,
}: {
  children: ReactNode;
  onSave: (f: FormData) => Promise<void>;
  onDone: () => void;
  draftKey: string;
  button?: string;
  onRecover?: (d: Record<string, any>) => void;
}) {
  const { profile, demo } = useStore();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [recovered, setRecovered] = useState(false);
  const ref = useRef<HTMLFormElement>(null),
    key = `steadily-draft:${demo ? "demo" : profile.user_id}:${draftKey}`;
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(key) || "null");
      if (d) {
        for (const e of Array.from(ref.current!.elements)) {
          if (
            e instanceof HTMLInputElement ||
            e instanceof HTMLTextAreaElement ||
            e instanceof HTMLSelectElement
          ) {
            if (e.name in d) {
              if (e instanceof HTMLInputElement && e.type === "checkbox")
                e.checked = d[e.name];
              else e.value = d[e.name];
            }
          }
        }
        setRecovered(true);
        onRecover?.(d);
      }
    } catch {
      /* Draft recovery is optional. */
    }
  }, [key]);
  function draft() {
    const values: Record<string, string | boolean> = {};
    for (const e of Array.from(ref.current!.elements)) {
      if (
        (e instanceof HTMLInputElement ||
          e instanceof HTMLTextAreaElement ||
          e instanceof HTMLSelectElement) &&
        e.name
      )
        values[e.name] =
          e instanceof HTMLInputElement && e.type === "checkbox"
            ? e.checked
            : e.value;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(values));
    } catch {
      /* Storage unavailable. */
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(new FormData(ref.current!));
      sessionStorage.removeItem(key);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form ref={ref} onChange={draft} onSubmit={submit}>
      {recovered && (
        <p className="notice">Recovered your unsaved draft from this tab.</p>
      )}
      {children}
      {error && (
        <p className="error" role="alert">
          {error} Your input is preserved. You can retry.
        </p>
      )}
      <footer className="form-footer">
        <span>Small steps count.</span>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : button}
          <ArrowUpRight size={16} />
        </Button>
      </footer>
    </form>
  );
}
export const str = (f: FormData, k: string) => String(f.get(k) || "").trim();
export const num = (f: FormData, k: string) => Number(f.get(k) || 0);
export function Plant() {
  return (
    <svg viewBox="0 0 230 190" className="plant-art" aria-hidden="true">
      <ellipse cx="127" cy="170" rx="80" ry="10" fill="#d6e2d2" />
      <path
        d="M125 130C128 91 110 65 112 31M126 126c2-27 22-52 43-74M122 102C101 94 79 77 70 55"
        fill="none"
        stroke="#6d8c62"
        strokeWidth="3"
      />
      <path d="M112 71C82 66 91 29 109 22c18 13 22 35 3 49" fill="#90aa7e" />
      <path d="M115 94C144 82 146 54 137 42c-22 4-33 26-22 52" fill="#608063" />
      <path d="M143 86c-2-29 29-41 44-37 0 24-16 42-44 37" fill="#88a080" />
      <path d="M93 83C68 88 49 71 51 54c24-9 40 6 42 29" fill="#b1bd95" />
      <path d="M131 117c20-23 48-16 55-2-15 19-36 25-55 2" fill="#76946d" />
      <path d="M101 124h52l-7 40c-11 12-29 12-39 0z" fill="#e6c8a3" />
      <path d="M98 121h58v9H98z" fill="#efd8bc" />
      <circle cx="51" cy="111" r="3" fill="#b7c8a8" />
      <path
        d="M199 93v10m-5-5h10M67 25v8m-4-4h8"
        stroke="#a3b696"
        strokeWidth="2"
      />
    </svg>
  );
}
