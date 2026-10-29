import { useEffect, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  ChartNoAxesCombined,
  ListChecks,
  Settings as SettingsIcon,
  LogOut,
  Leaf,
  ChevronRight,
  Check,
  LoaderCircle,
  RefreshCw,
  Menu,
  X,
  CloudCheck,
} from "lucide-react";
import { useStore } from "./store";
import { supabase } from "./api";
import { Today, DialogView, type Dialog } from "./Dashboard";
import { Calendar, Analytics, Habits, Settings } from "./Pages";
import { Button, Field, Plant } from "./components";
const nav = [
  ["today", "Today", LayoutDashboard],
  ["calendar", "Calendar & history", CalendarDays],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["habits", "Habits & goals", ListChecks],
  ["settings", "Settings", SettingsIcon],
] as const;
function Auth() {
  const { enterDemo, recovery, setRecovery, user } = useStore();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(
      recovery ? "reset" : "signin",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const update = recovery && !!user;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!supabase)
        throw new Error(
          "Connect Supabase using the setup guide to enable private accounts. You can explore the separate demo below.",
        );
      const f = new FormData(e.currentTarget),
        email = String(f.get("email") || "").trim(),
        password = String(f.get("password") || "");
      if (update) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovery(false);
        history.replaceState({}, "", "/today");
        setMessage("Your password has been updated.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/reset-password",
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a reset link is on its way. Check your inbox.",
        );
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/today" },
        });
        if (error) throw error;
        if (!data.session)
          setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function googleSignIn() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + "/today" },
      });
      if (error) throw error;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <Leaf size={25} />
          </span>
          <span>
            steadily<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">A LITTLE BETTER, EVERY DAY</span>
          <h1>
            Good things
            <br />
            grow with time.
          </h1>
          <p>
            A calm space for your habits, your focus,
            <br />
            and the person you’re becoming.
          </p>
          <Plant />
          <div className="auth-values">
            <span>
              <Check size={17} /> Your pace
            </span>
            <span>
              <Check size={17} /> Your progress
            </span>
            <span>
              <Check size={17} /> Your private space
            </span>
          </div>
        </div>
        <small>Make room for a little progress.</small>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">WELCOME TO YOUR LITTLE CORNER</span>
          <h2>
            {update
              ? "A fresh password."
              : mode === "signup"
                ? "Start something good."
                : mode === "reset"
                  ? "Let’s get you back in."
                  : "Welcome back."}
          </h2>
          <p className="muted">
            {update
              ? "Choose a secure password for your account."
              : mode === "signup"
                ? "Small beginnings. Meaningful change."
                : mode === "reset"
                  ? "We’ll send you a link to reset your password."
                  : "A fresh day. A little intention. A step forward."}
          </p>
          {!supabase && (
            <p className="notice">
              Preview mode · Private accounts become available after Supabase
              setup. Explore the working demo below.
            </p>
          )}
          {supabase && !update && mode !== "reset" && (
            <>
              <Button
                variant="secondary full"
                disabled={busy}
                onClick={googleSignIn}
              >
                <span
                  aria-hidden="true"
                  style={{ fontWeight: 700, color: "#4285f4", fontSize: 17 }}
                >
                  G
                </span>
                Continue with Google
              </Button>
              <div className="auth-divider">
                <span>or use your email</span>
              </div>
            </>
          )}
          <form onSubmit={submit}>
            {!update && (
              <Field label="Email address">
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
            )}
            {(mode !== "reset" || update) && (
              <Field label={update ? "New password" : "Password"}>
                <input
                  name="password"
                  type="password"
                  minLength={mode === "signin" && !update ? undefined : 8}
                  required
                  autoComplete={
                    mode === "signup" || update
                      ? "new-password"
                      : "current-password"
                  }
                  placeholder={
                    mode === "signin" && !update
                      ? "Your password"
                      : "At least 8 characters"
                  }
                />
              </Field>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy} variant="full">
              {busy ? <LoaderCircle className="spin" size={17} /> : null}
              {update
                ? "Update password"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
              <ChevronRight size={17} />
            </Button>
          </form>
          {!update && (
            <div className="auth-links">
              {mode === "signin" ? (
                <>
                  <button
                    onClick={() => {
                      setMode("reset");
                      setError("");
                      setMessage("");
                    }}
                  >
                    Forgot password?
                  </button>
                  <span>
                    New here?{" "}
                    <button
                      onClick={() => {
                        setMode("signup");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Create an account
                    </button>
                  </span>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMode("signin");
                    setRecovery(false);
                    setError("");
                    setMessage("");
                  }}
                >
                  Back to sign in
                </button>
              )}
            </div>
          )}
          <div className="auth-divider">
            <span>take a look around</span>
          </div>
          <Button variant="secondary full" onClick={enterDemo}>
            Explore the demo
            <ChevronRight size={17} />
          </Button>
          <p className="small muted center">
            A separate sample workspace. No account needed.
          </p>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const store = useStore();
  const {
    user,
    demo,
    loading,
    error,
    status,
    profile,
    recovery,
    exitDemo,
    refresh,
  } = store;
  const [page, setPage] = useState(location.pathname.split("/")[1] || "today"),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [menu, setMenu] = useState(false),
    [signError, setSignError] = useState("");
  function navigate(next: string) {
    setPage(next);
    history.pushState({}, "", "/" + next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const pop = () => setPage(location.pathname.split("/")[1] || "today");
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!user && !demo) setDialog(null);
  }, [user, demo]);
  if (loading)
    return (
      <div className="loading-screen">
        <Leaf size={35} />
        <h2>A little moment to settle in.</h2>
        <LoaderCircle className="spin" size={23} />
      </div>
    );
  if ((!user && !demo) || recovery) return <Auth />;
  if (error)
    return (
      <div className="loading-screen">
        <h2>We couldn’t load your workspace.</h2>
        <p className="error">{error}</p>
        <Button onClick={refresh}>
          <RefreshCw size={16} />
          Try again
        </Button>
        <Button variant="secondary" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  const active = nav.some((n) => n[0] === page) ? page : "today";
  async function signOut() {
    if (demo) {
      exitDemo();
      return;
    }
    const { error } = await supabase!.auth.signOut();
    if (error) setSignError(error.message);
    else {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith(`steadily-draft:${profile.user_id}:`))
          sessionStorage.removeItem(k);
      }
    }
  }
  return (
    <div className="app-layout">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="/today"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <span className="brand-icon">
            <Leaf size={24} />
          </span>
          <span>
            steadily<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="brand-caption">Small steps. Meaningful days.</p>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, C]) => (
            <a
              href={"/" + id}
              key={id}
              className={active === id ? "active" : ""}
              aria-current={active === id ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(id);
              }}
            >
              <C size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {active === id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Leaf size={22} />
          <p>
            Be patient with yourself.
            <br />
            Nothing in nature
            <br />
            blooms all year.
          </p>
          <span>YOU’RE RIGHT WHERE YOU NEED TO BE</span>
        </div>
        <div className="sidebar-bottom">
          <button
            className="profile-button"
            onClick={() => navigate("settings")}
          >
            <span className="avatar">
              {(profile.name || user?.email || "Y").slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{profile.name || "Your workspace"}</strong>
              <small>{demo ? "Demo explorer" : "Personal workspace"}</small>
            </span>
            <SettingsIcon size={16} />
          </button>
          <button className="sign-out" onClick={signOut}>
            <LogOut size={16} />
            {demo ? "Leave demo" : "Sign out"}
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>
              Your personal space <ChevronRight size={13} />{" "}
              <strong>{nav.find((n) => n[0] === active)?.[1]}</strong>
            </span>
          </div>
          <div>
            <span className="private-pill">
              <span className="tiny-dot" />
              {demo ? "DEMO WORKSPACE" : "JUST FOR YOU"}
            </span>
            <button
              className="top-avatar"
              onClick={() => navigate("settings")}
              aria-label="Open personal settings"
            >
              {(profile.name || "Y").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-bar">
            <span>
              You’re exploring sample data. Demo edits stay in this browser.
            </span>
            <button onClick={exitDemo}>
              Use my own workspace
              <ArrowIcon />
            </button>
          </div>
        )}
        <div className="page-content" key={`${demo ? "demo" : user?.id}`}>
          {signError && (
            <p role="alert" className="error">
              {signError}
            </p>
          )}
          {status && (
            <div
              className={`save-status ${status.startsWith("Save failed") ? "failed" : ""}`}
              role="status"
            >
              <CloudCheck size={14} />
              {status}
            </div>
          )}
          {active === "today" ? (
            <Today onDialog={setDialog} navigate={navigate} />
          ) : active === "calendar" ? (
            <Calendar onDialog={setDialog} />
          ) : active === "analytics" ? (
            <Analytics />
          ) : active === "habits" ? (
            <Habits onDialog={setDialog} />
          ) : (
            <Settings onDialog={setDialog} />
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} /> Steadily, at your own pace.
            </span>
            <span>Made for the person you’re becoming.</span>
          </footer>
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map(([id, label, C]) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => navigate(id)}
            aria-label={label}
          >
            <C size={20} />
            <span>
              {id === "calendar"
                ? "History"
                : id === "habits"
                  ? "Habits"
                  : label}
            </span>
          </button>
        ))}
      </nav>
      {dialog && (
        <DialogView
          key={JSON.stringify(dialog)}
          dialog={dialog}
          setDialog={setDialog}
          close={() => setDialog(null)}
        />
      )}
    </div>
  );
}
function ArrowIcon() {
  return <ChevronRight size={14} />;
}
