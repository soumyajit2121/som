# Implementation Plan — Cricket Team Manager

This is the working plan for the cricket tournament and match-management PWA. It was written before implementation and updated as the build progressed. The checklist at the end reflects the final state.

## 1. Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | One club uses the app. The club can field **several of its own teams** (for example "Team A" and "Team B"). Opponents are a separate entity.                                                                                                                                            |
| A2  | The business timezone is fixed to `Asia/Kolkata` (IST, +05:30, no DST). Every user-facing date and time is IST.                                                                                                                                                                         |
| A3  | Anyone can sign up with email and password, but a new account starts as **pending**. It cannot read team data until an administrator approves it. Administrators can also invite teammates by email; invited accounts are pre-approved.                                                 |
| A4  | The first administrator is bootstrapped with a documented SQL command (or the seed in development). After that, administrators promote others in the UI.                                                                                                                                |
| A5  | "Confirmed" is a player's own firm commitment to play. "Playing" is the administrator's final XI selection. A teammate may set their own status to Not Responded / Available / Maybe / Unavailable / Confirmed. Only administrators may set Playing, or change another player's status. |
| A6  | A teammate may **respond to any match of a team they belong to**. Responding creates their own participant row. This is self-service, not adding another player.                                                                                                                        |
| A7  | The 11-player readiness threshold counts participants in state **Confirmed or Playing**.                                                                                                                                                                                                |
| A8  | The 25-hour reminder is evaluated once per match occurrence (`starts_at`). If a match is rescheduled, a new occurrence (and so a new reminder) applies.                                                                                                                                 |
| A9  | Vercel Hobby cron runs at most once a day. Because of that, the documented production scheduler is a **GitHub Actions schedule (every 15 minutes)** or **Supabase `pg_cron` + `pg_net`**. Both call the same protected endpoint. A `vercel.json` cron is included for Vercel Pro plans. |
| A10 | Email and WhatsApp notifications are out of scope for V1. The channel abstraction allows them to be added later. Supabase Auth still sends its own auth emails (invite, password reset).                                                                                                |
| A11 | CricHeroes has no official public API. V1 stores a manually maintained URL and sends reminders only.                                                                                                                                                                                    |

## 2. Architecture

```
Browser (PWA, service worker)                       Vercel (Next.js 16, Node runtime)
 ├─ React Server Components ──── cookies ───────────► proxy.ts (session refresh, route guard)
 ├─ Server Actions (Zod-validated) ─────────────────► src/server/actions/*  ──► Supabase (user JWT) ──► Postgres + RLS
 ├─ /api/push/* (subscribe, unsubscribe, test) ─────► route handlers (user JWT, RLS)
 └─ sw.js: push + notificationclick + offline page
                                                     /api/cron/reminders (Bearer CRON_SECRET)
Scheduler (GitHub Actions / pg_cron / Vercel Cron) ─►  └─ service-role client ──► reminder engine ──► notifications + web-push
```

- **Every user request runs under the user's own JWT.** RLS in Postgres is the final authority. Server actions add Zod validation and friendly errors. The UI hides controls the user may not use.
- **The service-role key is used only in two places:** the reminder scheduler and administrator-only flows that need Supabase Admin Auth (invites). Both are server-only modules guarded by `import "server-only"`.
- **Business rules live in the database** as constraints, triggers and `SECURITY INVOKER`/`DEFINER` RPC functions. Examples are the teammate-created-match creator rule, the dummy-opponent generator, duplicate detection, audit logging and privileged-column protection. Because of that, direct PostgREST calls with the public anon key cannot bypass them.

## 3. Technology choices

| Concern    | Choice                                                                                             | Reason                                                           |
| ---------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Framework  | Next.js 16 App Router, React 19, TypeScript strict                                                 | Requested stack; server actions and RSC keep secrets server-side |
| Auth + DB  | Supabase Auth, Supabase Postgres 17, RLS                                                           | Requested; RLS gives database-level authorization                |
| Styling/UI | Tailwind CSS v4, shadcn-style components on Radix primitives (hand-written in `src/components/ui`) | Accessible primitives without a runtime design dependency        |
| Validation | Zod 4 (shared client/server schemas)                                                               | Requested                                                        |
| Dates      | Luxon (IANA zones)                                                                                 | Timezone-aware formatting and parsing; no manual offset maths    |
| Push       | `web-push` (VAPID) + custom `public/sw.js`                                                         | Standard Web Push; no extra PWA plugin needed                    |
| Tests      | Vitest (unit + DB integration), Playwright (E2E)                                                   | Requested                                                        |
| CI         | GitHub Actions                                                                                     | Requested                                                        |
| Hosting    | Vercel + Supabase Cloud                                                                            | Requested                                                        |

## 4. Database model (summary — full detail in `docs/DATA_MODEL.md`)

`app_roles`, `profiles` (public, non-sensitive), `profile_private` (phone), `notification_preferences`, `teams`, `team_memberships`, `venues`, `opponents` (`is_dummy`), `tournaments`, `tournament_enrollments`, `matches`, `match_participants`, `push_subscriptions`, `notifications`, `notification_deliveries`, `reminder_deliveries`, `audit_logs`.

IST storage for matches: `match_date date`, `start_time time`, `reporting_time time` and `timezone text = 'Asia/Kolkata'` preserve the exact business values. A trigger derives `starts_at timestamptz` and `reporting_at timestamptz` with `(date + time) AT TIME ZONE timezone`. Postgres does this conversion; the app never adds or subtracts 5:30.

## 5. Authorization model (full matrix in `docs/AUTHORIZATION_MATRIX.md`)

- `profiles.role ∈ {admin, teammate}` and `profiles.status ∈ {pending, active, inactive}`.
- Helper SQL functions `app.is_admin()` and `app.is_active()` (security definer, stable) are used inside RLS policies.
- Inactive and pending users fail `app.is_active()`, so they can read nothing except their own profile.
- A trigger blocks changes to privileged columns (`role`, `status`, `created_by` and so on) by non-admins. This prevents mass assignment even through direct API calls.
- Teammate match rules are enforced by RLS and triggers:
  - Insert is allowed only with `created_by = auth.uid()`, and a deferred constraint trigger requires the creator to be a participant at commit.
  - Update is allowed only for the creator, and only on basic columns.
  - Delete is allowed only for the creator, and only while no other participants exist.
- Participants: a teammate may insert, update or delete only their own row. They cannot set `playing`. They cannot delete their own row on a match they created.

## 6. Notification design (full detail in `docs/NOTIFICATIONS.md`)

- A channel-agnostic `notifications` row is always written first (in-app), then one `notification_deliveries` row per push subscription.
- The reminder engine is a pure function `evaluateReadiness(match, now)` plus an orchestrator that is idempotent through unique keys:
  - `reminder_deliveries (match_id, recipient_id, reminder_kind, occurrence)`
  - `notifications.dedupe_key`
  - `notification_deliveries (notification_id, channel, subscription_id)`
- Processing window: `starts_at - 25h <= now < starts_at`, for statuses draft, scheduled or confirmed. Late runs still fire. Repeat runs are no-ops.
- Push failures are classified as follows:
  - 404/410 → subscription expired and deleted.
  - 429/5xx/network → temporary, retried with backoff for up to 3 attempts.
  - Other 4xx → permanent.
- The in-app notification is never rolled back.

## 7. Implementation checklist

- [x] Scaffold Next.js 16 + TypeScript strict + Tailwind 4 + ESLint + Prettier
- [x] Supabase local config, migrations, RLS, triggers, RPCs, seed data
- [x] IST date library + tests (UTC server, non-India browser, midnight)
- [x] Auth: sign-up, sign-in, sign-out, password reset, session refresh proxy, pending/inactive gating
- [x] Profiles and private phone, notification preferences, account deactivation
- [x] Teams, memberships (unlimited), venues, opponents, dummy opponents
- [x] Tournaments: CRUD, enroll teams, archive, views (current/upcoming/completed/archived)
- [x] Matches: create/edit/cancel/delete, category rules, duplicate warning + admin override, list views, calendar, details
- [x] Participation: self-response, admin management, playing XI, counts, readiness
- [x] Reminder engine + cron endpoint + CLI command, idempotent, retries
- [x] In-app notification center (badge, filters, read/unread, deep links)
- [x] PWA: manifest, icons, service worker, offline page, push subscribe/unsubscribe/test, device list
- [x] Admin area: users (approve, invite, promote, deactivate), audit log, deliveries
- [x] Unit, integration/authorization and E2E tests
- [x] GitHub Actions CI, Vercel config, scheduler workflow
- [x] Documentation set
