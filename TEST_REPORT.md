# Verification report

Completed locally on 29 October 2026 (Asia/Kolkata). No live deployment or Supabase project was configured.

## Automated checks

- Production build: TypeScript compilation and Vite production bundle pass.
- **38 tests pass**: 29 calculation/behavior tests and 9 actual PostgreSQL migration/security tests.
- Runtime production dependency audit: no known production vulnerabilities reported by `npm audit --omit=dev` at the time of testing.

Calculation tests cover inclusive wake-window endpoints, explicit early-time policy, overnight windows, weekday/one-time/date-bound scheduling, archives, effective historical targets, week start, zero-habit days, occurrence-weighted percentages, future-date exclusion, unlogged/partial/success states, past corrections, current/longest streaks, skipped rest days, missed scheduled days, multiple study and meditation sessions, growth completion, skill session/minutes rules, task score isolation, paused/running timer recovery after serialization, manual corrections, timezone date assignment, midnight splitting, and DST 23/25-hour boundaries.

Database tests execute the delivered migration in **PGlite (embedded PostgreSQL)**. The harness supplies an `auth.users` table, roles, and an `auth.uid()` function with two simulated JWT subjects. It verifies migration syntax/execution, exactly five idempotently seeded defaults, isolation across every private table, ownership-spoof rejection, cross-user habit foreign-key rejection, unauthorized update/delete behavior, anonymous access denial, daily-record uniqueness/upserts, atomic timer lifecycle, repeated start/finish safety, duplicate-active-timer rejection, cross-user timer protection, immutable past definitions, and prospective target versions.

This is database-level policy testing with simulated identities, not an end-to-end test of Supabase's hosted authentication or its network API. The optional `tests/isolation.mjs` exercises hosted sign-in, cross-user reads/writes, and sign-out/re-sign-in persistence when supplied two disposable confirmed accounts.

## Browser checks performed

Used the actual running app and then its production build:

- Desktop layout at 1440 × 1000; mobile layout at 390 × 844.
- Mobile document width equals viewport width (390px); no horizontal page overflow.
- Separate demo entry and labeled browser-local sample workspace.
- Wake entry corrected from 07:15 to 06:30; habit completed and score updated immediately.
- Study timer start → refresh → recovered elapsed time/label → pause → finish; no duplicate session in the UI.
- Weekly analytics and monthly trend/heatmap/time-by-week sections rendered from the saved demo records.
- Custom numeric habit created with a 10-page target; it appeared in management and Today with the correct units.
- Habit archive effective tomorrow appeared in the archived/scheduled-archives view while remaining scheduled today.
- Light/dark appearance saved, survived refresh, and rendered correctly in production preview.
- JSON export initiated a real download; structured export includes records, profile, timezone, and calculated summaries.
- Direct production-preview refresh at `/settings` loaded the app. Netlify-specific routing still requires live-host verification.

A screenshot is delivered separately as `steadily-preview.png`.

## Required live acceptance checks

After configuring Supabase and Netlify, verify these before relying on the app for real records:

1. Signup, email confirmation, sign-in, sign-out, reset-email delivery, and new-password submission using your SMTP configuration and production redirect domain.
2. Record survival after refresh, browser close, sign-out/re-sign-in, and sign-in on a second device. Confirm account A cannot read/write B's data through hosted APIs; run the supplied live smoke test.
3. Exercise each default habit, custom recurrence/archive/restore, task/subtask editing, journal corrections, and CSV export against the hosted database.
4. Leave a live timer across midnight and a refresh; finish and review both dates. Repeat timezone boundaries applicable to your location.
5. Open/refresh the production URLs `/today`, `/calendar`, `/analytics`, `/habits`, `/settings`, and `/reset-password` on Netlify.
6. Check actual mobile Safari/Chrome and keyboard/screen-reader behavior. Local responsive checks do not replace device testing.

## Limitations and explicit choices

- **Not hosted.** A Supabase project, migration application, two public build-time values, auth email/redirect configuration, and a Netlify deployment are still required. No real credentials are included.
- The included prebuilt `dist/` is a credential-free demo build. Rebuild with your environment configuration for real accounts.
- No closed-site reminders, notification scheduler, push delivery, or offline write queue. Reminder preferences only show notes inside the app.
- Data refreshes on sign-in, reload, and window focus; simultaneous devices do not receive live push updates while continuously focused. Concurrent edits to the same form use the last successful write. Timer transitions have stronger database locking/idempotency.
- Habit creation and reorder involve sequential acknowledged writes. If a connection fails between creation steps, the management screen lets you finish the definition. If reordering is interrupted, reload and reorder again. These operations do not change daily record values.
- New definitions start at their first effective version; signup does not invent historical schedules. Earlier existing scheduled records remain correctable.
- Running/paused sessions contribute to logged totals only after finishing. Manual corrections replace timer intervals and assign a selected date explicitly.
- CSV retains nested details in a JSON column; JSON is the recommended full-fidelity export. Import/restore is not implemented.
- No permanent habit deletion is exposed; archive/restore preserves history.
