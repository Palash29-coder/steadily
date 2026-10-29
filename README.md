# Steadily

A calm, responsive personal productivity app for habits, study, meditation, skills, tasks, and reflection. Built with React, TypeScript, Vite, Tailwind CSS, Recharts, and Supabase. Ready for Netlify.

## Start here

1. Install Node.js **22.12 or newer** (Node 22 LTS recommended).
2. Open a terminal in this folder, then run `npm ci` and `npm run dev`.
3. Open the local URL printed by Vite. Without credentials, use **Explore the demo**.
4. For your own private workspace, complete the Supabase setup below. The demo uses a separate browser-only key and never populates a real account.

The live deployment has Supabase configured. For a separate deployment, set your public environment values and rebuild to enable accounts and database persistence. Demo records remain browser-local.

## Supabase setup (required for real accounts)

1. Create a Supabase project in your own account.
2. In SQL Editor, run `supabase/migrations/001_initial.sql` **once** against the new database. It creates the tables, ownership constraints, indexes, RLS policies, default-habit initialization, and atomic timer transitions. Alternatively, link the Supabase CLI to your project and run `supabase db push`.
3. Copy `.env.example` to `.env.local`. Fill in **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** from your project's API settings. The latter accepts a public publishable key or the legacy anon key. Never use `service_role` or a secret key.
4. Under Authentication → Providers, enable email/password. Keep email confirmation enabled for production. Configure your own SMTP provider for dependable confirmation and password-reset emails.
5. Under Authentication → URL Configuration, set Site URL to your eventual production origin. Add these exact redirect URLs (adjust the port if necessary):
   - `http://localhost:5173/today`
   - `http://localhost:5173/reset-password`
   - `http://127.0.0.1:5173/today`
   - `http://127.0.0.1:5173/reset-password`
   - `https://YOUR-SITE.netlify.app/today`
   - `https://YOUR-SITE.netlify.app/reset-password`
6. Restart the development server after changing environment variables. Sign up, confirm your email, and sign in. Five default habits are created once for your account, starting on your local signup day.

Each table enforces `auth.uid() = user_id`. Habit child records also have an ownership-aware composite foreign key. An account cannot attach a record to another account's habit. Authenticated clients cannot permanently delete habit definitions or historical versions. The app contains no privileged backend key.

## Netlify deployment

The current deployment is https://steadily-palash29.netlify.app/ with automatic publishing from the private GitHub repository. See DEPLOYMENT.md for connected-service details. These steps also support a new deployment.

1. Put this folder's contents in your Git repository. Do not commit `.env.local` or `node_modules`.
2. In Netlify, choose **Add new project → Import an existing project** and connect that repository.
3. If the repository has this folder at its root, leave base directory blank. If nested, set base directory to its actual repository path.
4. Set build command to `npm run build` and publish directory to `dist`. These values, Node 22, the SPA fallback, and response headers are already in `netlify.toml`.
5. Add the two `VITE_SUPABASE_*` values in Netlify → Environment variables, available during builds. They are deliberately public client configuration; RLS protects the database.
6. Deploy. Then replace the production URLs in Supabase Authentication URL Configuration with the actual returned domain. If you use a custom domain, add its `/today` and `/reset-password` redirects too.
7. Verify direct navigation and refresh at `/calendar`, `/analytics`, `/habits`, `/settings`, and `/reset-password`.
8. Run the live acceptance checklist in `TEST_REPORT.md` against the deployed site.

A manual `dist/` upload can also work after setting local credentials and running `npm run build`; Git-based builds are recommended so environment changes are rebuilt consistently. Netlify hosts static assets; **Supabase stores authenticated records**. No Netlify Functions are needed.

## What works

- Today dashboard, five default habits, goal progress, successful-day streak, separate tasks summary.
- Inclusive wake-up window, with an explicit option to count earlier times. Overnight time windows are supported.
- Study and meditation timers: start, pause, resume, finish, recovery after refresh or browser close, multiple sessions, manual additions and corrections. Finished sessions can be edited/deleted in Calendar → Session notebook. A timer in progress is shown even if its habit has been archived.
- Skill sessions with name, duration, and learning notes; completion by one session or target minutes.
- Self-growth completion, title, source, takeaway, reflection, and notes.
- Custom checkbox, duration, numeric, and time-window habits; categories, icons, colors, schedules, start/end dates, reminder notes, reorder, archive, restore.
- Tasks with descriptions, priorities, categories, dates, notes, daily/weekday recurrence, subtasks, completion/reopening per occurrence, editing, and confirmed permanent deletion.
- Monthly calendar, past-day corrections, sessions and lesson details, and daily mood/reflection journal.
- Weekly and monthly analytics, daily completion/study/meditation chart selectors, habit rates, occurrence totals, successful days, longest streak, matched elapsed-period comparison, and monthly heatmap and time-by-week charts.
- Google sign-in, email signup/sign-in/sign-out/reset, persistent auth sessions, private database storage, loads after sign-in and refreshes when the window regains focus.
- Light/dark/system theme, timezone, week start, display name, habit-target editing, CSV/JSON exports, saving/saved/error feedback, and per-user form draft recovery within the browser tab.

## Scoring and history

All views and exports use `src/core.ts`:

- Daily score = completed scheduled habits / scheduled habits. Tasks never alter this score.
- Duration and count goals complete at or above the target. Checkbox goals need a check. Time-window goals include both endpoints; earlier times count only if that rule is enabled. For overnight windows, the overnight range applies.
- Period score uses total completed **occurrences** / scheduled occurrences over elapsed dates. Future dates are excluded. Today’s unfinished goals count as incomplete, not as a final judgment on the day.
- Unlogged, partial, successful, unscheduled, and future days remain distinct. A zero-habit day displays an unscheduled state and does not divide by zero.
- A successful day completes every scheduled habit. Rest days neither extend nor break streaks. Today in progress does not break yesterday's current streak.
- Habit definitions are effective-dated snapshots. Edits default to tomorrow; the form can explicitly apply them today or later. Versions before today cannot be edited through client access. Earlier scores retain earlier targets, names, and schedules. Archiving adds a dated version and keeps history. Uncheck archive in the edit form to restore.
- A new habit cannot introduce scheduled occurrences before its first effective version. Default habits begin on the local signup date. Past entries for dates on/after that start may be corrected.
- Replacing a definition effective today deliberately updates today's score. Multiple edits for the same effective day replace that day's pending version.

## Time and duplicate prevention

Database timestamps use `timestamptz`. Calendar keys use `YYYY-MM-DD`. Default timezone is Asia/Kolkata; the user may choose another IANA timezone.

Manual sessions belong wholly to their selected local date. Timer sessions keep their originating timezone and store actual start/end intervals. Completed intervals split at local midnight using elapsed milliseconds, including DST 23/25-hour days. Paused time is excluded. A later timezone change leaves existing session dates intact.

The UI's interval only redraws the timer; duration comes from timestamps. Database timer transitions lock a session row and use server time. One active timer per user/kind is enforced by a partial unique index. Start uses a stable UUID and finish is idempotent, so retrying after a network response is lost cannot create another session. Repeated manual saves upsert the same UUID. Daily records and journals have logical uniqueness constraints.

Running/paused sessions do not add to logged totals until **Finish & log**. The UI updates its date every minute and whenever the app rerenders. Browser clock accuracy affects the live display, but saved authenticated timer intervals use database time.

## Data model

- `profiles`: identity preferences and timezone.
- `habits`: stable habit identity/kind/order.
- `habit_versions`: effective-dated target, schedule, presentation, archive, and skill rules.
- `daily_records`: unique habit/date records, including self-growth and custom habit fields.
- `sessions`: study, meditation, and skill practice; manual duration or timer intervals/state.
- `tasks`: recurrence definitions, per-date completion, and per-occurrence subtasks.
- `journals`: unique user/date daily reflections.

Self-growth lessons live in `daily_records`; skill entries live in `sessions`. These use typed discriminators through their habit/session kinds rather than unnecessary parallel tables. All tables have ownership fields and timestamps.

## Export

Settings exports all loaded records and effective definitions plus shared-logic daily summaries. JSON is a full-fidelity structured export. CSV uses `record_type,date,id,data_json` so nested subtasks, interval arrays, recurrence, and complete records are retained. Duration fields use minutes; interval timestamps are ISO 8601. CSV fields are quoted and formula-prefixed strings are escaped. There is no import or automatic restore feature.

## Offline and reminders

Authenticated writes require a network connection and database confirmation. Failed forms remain open with retry instructions; drafts are stored per user in sessionStorage and are cleared after a successful save or sign-out. Demo data uses its own localStorage namespace. There is no offline write queue or service worker; no pending local edit is presented as remotely saved.

Reminder preferences control **in-app reminder notes only**. No email scheduler, push service, or closed-site notification delivery is implemented, and no notification permission is requested.

## Commands and versions

- `npm run dev`: local Vite development server.
- `npm run build`: TypeScript check and production build.
- `npm run preview`: preview the built site.
- `npm test`: calculation tests and the actual migration/RLS/timer tests in embedded PostgreSQL (PGlite).
- `npm run test:rls`: optional two-account live Supabase isolation/persistence smoke test.

Pinned dependencies: React/React DOM 19.1.1, TypeScript 5.9.2, Vite 7.1.7, Tailwind CSS and Tailwind Vite plugin 4.1.13, Supabase JS 2.58.0, Recharts 3.2.1, Lucide React 0.544.0, React Vite plugin 5.0.3, Vitest 3.2.4, PGlite 0.5.13. Exact resolved transitive versions are in `package-lock.json`. These compatible stable versions were selected for a reproducible build; they are not a claim to be the newest releases.

For the optional live test, create **two disposable, confirmed** Supabase test users. Add `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, and `TEST_USER_B_PASSWORD` to a private local environment file along with your two public configuration values. Run `node --env-file=.env.local tests/isolation.mjs`. Do not commit or paste account passwords. The script signs in both users, initializes their defaults, inserts one disposable task, tests isolation/persistence, and removes its own task. It does not test email delivery or create/delete the auth accounts.

## Troubleshooting

- **Only demo mode appears:** environment values were absent/placeholder at build time. Set them and rebuild/restart.
- **Table/RPC not found:** apply the migration to the same Supabase project referenced by your URL.
- **RLS/permission error:** confirm the user is signed in and the SQL migration completed. Do not disable RLS to bypass an error.
- **Confirmation/reset email missing:** check SMTP, email rate limits/spam, and allowed redirect URLs. Expired reset links require requesting a fresh email.
- **A timer already exists on another device:** return to Today, refresh or refocus the window, then resume/finish the existing timer. A unique index prevents starting a duplicate.
- **Network fails on save:** keep the form open and use the save button again after connection returns. A successful confirmation only appears after the backend acknowledges the write.
- **A newly archived habit still shows today:** archive defaults to tomorrow. Today and earlier history are retained intentionally.
- **Direct URL 404 on Netlify:** check base directory and ensure `netlify.toml` is part of the deployed project. Its fallback must publish alongside the Vite build.
- **Local hot reload after changing the context module:** refresh the page. The production build does not use hot reload.
- **Npm cache permission issue:** use a writable cache path, for example `npm ci --cache ./work-npm-cache`, rather than modifying system-owned folders.

## Reference documentation

[Supabase password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vite setup](https://vite.dev/guide/).

See `TEST_REPORT.md` for completed verification and the remaining live-service acceptance checklist.

## Shared Supabase project setup

Steadily uses the existing Supabase project with a separate `steadily_` prefix on all tables, indexes, and application functions. The existing study app's `public.profiles` and other tables remain separate. The API maps its logical records to `steadily_profiles`, `steadily_habits`, `steadily_habit_versions`, `steadily_daily_records`, `steadily_sessions`, `steadily_tasks`, and `steadily_journals`. Initialization and timer RPCs are `steadily_initialize_workspace` and `steadily_timer_transition`.

Authentication is shared at the Supabase-project level. Existing account credentials work across apps using this project, while Steadily's RLS-protected records stay in its own tables. Keep the existing Site URL and redirect allowlist. Add Steadily's `/today` and `/reset-password` URLs to that allowlist; the app explicitly requests its own return URLs.
