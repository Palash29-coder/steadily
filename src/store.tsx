import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  type Data,
  type Profile,
  type Session,
  emptyData,
  defaultProfile,
} from "./model";
import {
  supabase,
  fetchData,
  fetchProfile,
  tables,
  demoData,
  demoProfile,
} from "./api";
import { localDate } from "./core";
type Store = {
  data: Data;
  profile: Profile;
  user: User | null;
  demo: boolean;
  loading: boolean;
  error: string;
  status: string;
  recovery: boolean;
  save: (key: keyof Data, row: any, conflict?: string) => Promise<void>;
  remove: (key: keyof Data, id: string) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  timer: (s: Session, action: string) => Promise<void>;
  refresh: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
  resetDemo: () => void;
  setRecovery: (x: boolean) => void;
};
const Context = createContext<Store>(null!);
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData),
    [profile, setProfile] = useState<Profile>(defaultProfile("")),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [recovery, setRecovery] = useState(location.pathname === "/reset-password");
  const [, setClock] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClock((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const epoch = useRef(0),
    busy = useRef(false),
    demoRef = useRef(false);
  async function load(u: User) {
    const e = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase!.rpc(
        "steadily_initialize_workspace",
      );
      if (err) throw err;
      const [d, p] = await Promise.all([fetchData(u.id), fetchProfile(u.id)]);
      if (e === epoch.current) {
        setData(d);
        setProfile(p);
      }
    } catch (err) {
      if (e === epoch.current) setError((err as Error).message);
    } finally {
      if (e === epoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabase) {
      if (sessionStorage.getItem("steadily-demo-active")) enterDemo();
      else setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        !session &&
        event === "INITIAL_SESSION" &&
        sessionStorage.getItem("steadily-demo-active")
      ) {
        enterDemo();
        return;
      }
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setUser(session?.user || null);
      if (session?.user) {
        sessionStorage.removeItem("steadily-demo-active");
        setDemo(false);
        demoRef.current = false;
        if (event !== "TOKEN_REFRESHED")
          setTimeout(() => load(session.user), 0);
      } else {
        ++epoch.current;
        setData(emptyData());
        setProfile(defaultProfile(""));
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        profile.theme === "dark" ||
          (profile.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile.theme]);
  async function operation(fn: () => Promise<void>) {
    if (busy.current)
      throw new Error("A save is already in progress. Please wait.");
    busy.current = true;
    setStatus("Saving…");
    const e = epoch.current;
    try {
      await fn();
      if (e === epoch.current)
        setStatus(
          demoRef.current
            ? "Saved to demo on this browser"
            : "Saved to your workspace",
        );
    } catch (err) {
      if (e === epoch.current)
        setStatus("Save failed — your form is still here. Retry when ready.");
      throw err;
    } finally {
      busy.current = false;
    }
  }
  function persist(d: Data, p = profile) {
    if (demoRef.current)
      localStorage.setItem(
        "steadily-demo-v1",
        JSON.stringify({ data: d, profile: p }),
      );
  }
  async function save(key: keyof Data, row: any, conflict = "id") {
    const saveEpoch = epoch.current;
    await operation(async () => {
      if (!demoRef.current) {
        const { error } = await supabase!
          .from(tables[key])
          .upsert(row, { onConflict: conflict });
        if (error) throw error;
      }
      if (saveEpoch !== epoch.current) return;
      setData((old) => {
        const next = {
          ...old,
          [key]: [
            ...old[key].filter((x: any) =>
              key === "records"
                ? !(x.habit_id === row.habit_id && x.date === row.date)
                : key === "versions"
                  ? !(
                      x.habit_id === row.habit_id &&
                      x.effective_from === row.effective_from
                    )
                  : key === "journals"
                    ? x.date !== row.date
                    : x.id !== row.id,
            ),
            row,
          ],
        };
        persist(next);
        return next;
      });
    });
  }
  async function remove(key: keyof Data, id: string) {
    const saveEpoch = epoch.current;
    await operation(async () => {
      if (!demoRef.current) {
        const { error } = await supabase!
          .from(tables[key])
          .delete()
          .eq("id", id)
          .eq("user_id", user!.id);
        if (error) throw error;
      }
      if (saveEpoch !== epoch.current) return;
      setData((old) => {
        const next = { ...old, [key]: old[key].filter((x) => x.id !== id) };
        persist(next);
        return next;
      });
    });
  }
  async function saveProfile(p: Profile) {
    const saveEpoch = epoch.current;
    await operation(async () => {
      if (!demoRef.current) {
        const { error } = await supabase!.from("steadily_profiles").upsert(p);
        if (error) throw error;
      }
      if (saveEpoch !== epoch.current) return;
      setProfile(p);
      persist(data, p);
    });
  }
  async function timer(s: Session, action: string) {
    const saveEpoch = epoch.current;
    await operation(async () => {
      let row = s;
      if (demoRef.current) {
        const now = new Date().toISOString();
        row = { ...s, segments: [...s.segments] };
        if (["pause", "finish"].includes(action) && row.running_since) {
          row.segments.push({ start: row.running_since, end: now });
          row.running_since = null;
        }
        if (action === "start" || action === "resume") {
          row.state = "running";
          row.running_since = row.running_since || now;
        }
        if (action === "pause") row.state = "paused";
        if (action === "finish") row.state = "finished";
      } else {
        const { data: d, error } = await supabase!.rpc(
          "steadily_timer_transition",
          {
            timer_id: s.id,
            action,
            timer_kind: s.kind,
            timer_label: s.label,
            timer_notes: s.notes,
          },
        );
        if (error) throw error;
        row = d;
      }
      if (saveEpoch !== epoch.current) return;
      setData((old) => {
        const next = {
          ...old,
          sessions: [...old.sessions.filter((x) => x.id !== row.id), row],
        };
        persist(next);
        return next;
      });
    });
  }
  function enterDemo() {
    sessionStorage.setItem("steadily-demo-active", "1");
    ++epoch.current;
    demoRef.current = true;
    setDemo(true);
    setUser(null);
    setError("");
    setStatus("");
    try {
      const old = JSON.parse(
        localStorage.getItem("steadily-demo-v1") || "null",
      );
      setData(old?.data || demoData(localDate()));
      setProfile(old?.profile || demoProfile());
    } catch {
      setData(demoData(localDate()));
      setProfile(demoProfile());
    }
    setLoading(false);
  }
  function exitDemo() {
    sessionStorage.removeItem("steadily-demo-active");
    ++epoch.current;
    demoRef.current = false;
    setDemo(false);
    setData(emptyData());
    setProfile(defaultProfile(""));
    setStatus("");
  }
  function resetDemo() {
    localStorage.removeItem("steadily-demo-v1");
    const d = emptyData();
    const p = demoProfile();
    setData(d);
    setProfile(p);
    persist(d, p);
  }
  async function refresh() {
    if (demoRef.current) return;
    if (user) await load(user);
  }
  useEffect(() => {
    const refreshOnFocus = () => {
      if (user && !demoRef.current && !busy.current) {
        const e = epoch.current;
        fetchData(user.id)
          .then((d) => {
            if (e === epoch.current && !demoRef.current) setData(d);
          })
          .catch(() =>
            setStatus("Could not refresh. Your last loaded records are shown."),
          );
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [user]);
  return (
    <Context.Provider
      value={{
        data,
        profile,
        user,
        demo,
        loading,
        error,
        status,
        recovery,
        save,
        remove,
        saveProfile,
        timer,
        refresh,
        enterDemo,
        exitDemo,
        resetDemo,
        setRecovery,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
