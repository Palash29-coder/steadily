# Deployment status — 29 October 2026

- Live website: https://steadily-palash29.netlify.app/
- Private source repository: https://github.com/Palash29-coder/steadily
- Netlify project: https://app.netlify.com/projects/steadily-palash29

Automatic publishing from GitHub main is enabled. Public Supabase URL and publishable key are configured in Netlify. No service-role key or privileged credential is included in the frontend or source archive.

## Supabase connection

The existing Mumbai Supabase project is active. Seven `steadily_` tables and isolated functions have been applied with row-level security. The existing app tables and Site URL are preserved. Steadily’s `/today` and `/reset-password` production URLs are allowed for authentication callbacks.

Email/password and Google providers are enabled. The frontend includes Continue with Google, email signup/sign-in, password recovery, and session restoration.

Supabase default SMTP is still in use: email delivery is restricted to project team addresses. Set up custom SMTP for signup confirmations and password resets for other email addresses. Google sign-in does not require SMTP.

## Verification

39 local tests pass, including PostgreSQL policy/ownership tests and preservation of the existing profiles table. TypeScript and production build pass. Real-account sign-in and cross-device acceptance checks are described in TEST_REPORT.md.
