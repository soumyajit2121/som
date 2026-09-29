# Cricket Team Manager

A responsive, installable web app (PWA) for a cricket club in India. It tracks tournaments, tournament and practice matches, player availability and match readiness. It sends in-app and mobile push reminders when a match is short of players or still has a placeholder opponent.

All dates and times are **India Standard Time (IST, Asia/Kolkata, UTC+05:30)**.

---

## Contents

1. [Core features](#core-features)
2. [Architecture](#architecture)
3. [Technology stack](#technology-stack)
4. [Prerequisites](#prerequisites)
5. [Local setup](#local-setup)
6. [Environment variables](#environment-variables)
7. [Database: migrations and seed](#database-migrations-and-seed)
8. [Development, test and build commands](#development-test-and-build-commands)
9. [PWA setup](#pwa-setup)
10. [Push notification setup](#push-notification-setup)
11. [Scheduler setup](#scheduler-setup)
12. [Deployment](#deployment)
13. [Roles and permissions](#roles-and-permissions)
14. [How IST dates are handled](#how-ist-dates-are-handled)
15. [Troubleshooting](#troubleshooting)
16. [Known limitations](#known-limitations)

---

## Core features

**Accounts**

- Email and password sign-in, sign-up, password reset and secure cookie sessions.
- New accounts wait for administrator approval. Administrators can also invite teammates, who are pre-approved.
- Accounts can be deactivated.

**Roles**

- Two roles: **Administrator** and **Teammate**.
- Rules are enforced in the UI, in server actions and API routes, and in Postgres through row-level security (RLS) and triggers.

**Tournaments**

- Create, edit, archive and delete tournaments (deleting is blocked once a tournament has matches).
- Enrol teams in tournaments.
- Views: Current, Upcoming, Completed and Archived.

**Matches**

- Two categories: **Tournament Match** (requires an enrolled tournament) and **Practice Match** (never stores a tournament).
- Views: Upcoming, Past, Tournament, Practice, My Matches, Team Matches and a Calendar.
- Search, filter and sort.
- Duplicate-fixture warning, which an administrator can override.
- Cancel, restore and delete matches, and take ownership of a match.

**Opponents**

- Pick an existing opponent, or use **“Use dummy opponent”** to generate `Dummy Team 001`, `Dummy Team 002` and so on. Dummy status is stored in an explicit `is_dummy` flag.
- Administrators replace the placeholder later, and the change is recorded in the audit history.

**Participation**

- States: Not Responded, Available, Maybe, Unavailable, Confirmed and Playing (the administrator's final XI).
- Per-match counts: squad, invited, each state, and how many more are needed to reach 11.
- Squads have no size limit.

**Reminders**

- 25 hours before a match starts, administrators are warned if fewer than 11 players are confirmed and/or the opponent is still a placeholder.
- When both apply, they get one combined warning.
- Reminders are idempotent and retry safely.

**Notifications**

- In-app notification centre with an unread badge, read/unread toggles, mark-all-read, filters by type and by match, and deep links.
- Web Push to registered devices, with per-category preferences, multiple devices, device removal and a test notification.

**Other**

- Administration pages for users, roles, teams and squads, opponents and venues, notification delivery records and audit history.
- CricHeroes: an optional, manually maintained match URL plus reminders to update it. There is no scraping or automation.

---

## Architecture

```
Browser / installed PWA ──► Next.js 16 on Vercel (Node runtime)
  │  service worker (push, offline)   ├─ proxy.ts: session refresh + route guard
  │                                   ├─ Server Components & Server Actions (Zod-validated)
  │                                   ├─ /api/* JSON routes
  │                                   └─ /api/cron/reminders  (Bearer CRON_SECRET)
  │                                           │
  └──────────── no direct DB access ──────────┼──► Supabase Auth
                                              └──► Supabase Postgres (RLS, triggers, RPCs)
Scheduler (GitHub Actions every 15 min │ pg_cron │ Vercel Cron) ──► /api/cron/reminders
```

- User requests run under the **user's own JWT**, so RLS always applies.
- The **service-role key** is used only by the scheduler and for administrator invites. Both run in server-only modules.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Technology stack

| Area          | Choice                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| Framework     | Next.js 16 (App Router), React 19, TypeScript (strict)                               |
| Data and auth | Supabase (Postgres 17, Auth, PostgREST), row-level security                          |
| UI            | Tailwind CSS 4, accessible shadcn-style components on Radix primitives, lucide icons |
| Validation    | Zod 4, with schemas shared by client and server                                      |
| Dates         | Luxon, using the IANA `Asia/Kolkata` zone                                            |
| Push          | `web-push` (VAPID) and a hand-written service worker                                 |
| Tests         | Vitest (unit and DB integration), Playwright (end-to-end, desktop and mobile)        |
| Quality       | ESLint (next/core-web-vitals + TypeScript), Prettier                                 |
| CI/CD         | GitHub Actions, Vercel                                                               |

## Prerequisites

- Node.js **22** (20.9+ also works) and npm 10.
- Docker, which the Supabase CLI uses to run the local stack.
- The Supabase CLI is installed as a dev dependency, so `npx supabase …` works.

## Local setup

```bash
git clone <your-repo-url> cricket-team-manager && cd cricket-team-manager
npm ci

# 1. Start local Supabase (Postgres, Auth, REST API, Mailpit inbox)
npm run db:start

# 2. Create .env.local from the values printed by `npx supabase status`
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL      = API_URL            (http://127.0.0.1:54321)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY     = SERVICE_ROLE_KEY
#   CRON_SECRET                   = any long random string (openssl rand -hex 32)
#   VAPID keys                    = npx web-push generate-vapid-keys

# 3. Apply migrations and seed demo data
npm run db:reset

# 4. Run the app
npm run dev          # http://localhost:3000
```

**Demo accounts** (fictional; the password for all of them is `Password123!`):

| Email                                           | Role / state      |
| ----------------------------------------------- | ----------------- |
| `admin@example.com`, `coach@example.com`        | Administrators    |
| `player01@example.com` … `player14@example.com` | Teammates         |
| `pending@example.com`                           | Awaiting approval |
| `inactive@example.com`                          | Deactivated       |

Auth emails (password reset, invites) go to the local Mailpit inbox at <http://127.0.0.1:54324>.

## Environment variables

| Variable                        | Where it is used   | Secret?     | Notes                                                        |
| ------------------------------- | ------------------ | ----------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | browser + server   | no          | Supabase project URL                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server   | no (public) | anon/publishable key; data is protected by RLS               |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only        | **yes**     | scheduler and invites only; never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL`          | server             | no          | base URL used in auth email links                            |
| `CRON_SECRET`                   | server + scheduler | **yes**     | at least 16 characters; sent as `Authorization: Bearer …`    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | browser + server   | no          | Web Push public key                                          |
| `VAPID_PRIVATE_KEY`             | server only        | **yes**     | Web Push private key; never commit it                        |
| `VAPID_SUBJECT`                 | server             | no          | `mailto:` contact address for push services                  |

Only `.env.example` (placeholders) is committed. `.env*` files are git-ignored.

## Database: migrations and seed

Migrations are in `supabase/migrations/`:

| File                       | Contents                                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| `…_core_schema.sql`        | tables, enums, constraints, indexes                                        |
| `…_rules_and_triggers.sql` | authorization helpers, business rules, audit logging, notification fan-out |
| `…_rls_views_rpc.sql`      | RLS policies, grants, the `match_overview` view, RPC functions             |

`supabase/seed.sql` holds fictional demo data. Dates are relative to "today in IST".

| Command                             | What it does                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `npm run db:reset`                  | recreate the local DB, apply all migrations and seed           |
| `npx supabase migration new <name>` | create a new migration                                         |
| `npm run db:types`                  | regenerate `src/lib/supabase/database.types.ts`                |
| `npx supabase db push`              | apply migrations to the linked hosted project (see Deployment) |

## Development, test and build commands

| Command                           | What it does                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                     | development server                                                                 |
| `npm run format` / `format:check` | Prettier                                                                           |
| `npm run lint`                    | ESLint                                                                             |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                                                    |
| `npm run test`                    | unit tests (no database needed)                                                    |
| `npm run test:integration`        | authorization, RLS, reminder and push tests against local Supabase                 |
| `npm run test:e2e`                | Playwright end-to-end tests (needs `db:reset` and a built app or a running server) |
| `npm run build` / `start`         | production build and server                                                        |
| `npm run reminders:run`           | run one scheduler tick locally (see below)                                         |
| `npm run validate`                | format check, lint, typecheck, unit tests and build                                |

If Playwright cannot download browsers, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium`.

## PWA setup

The PWA works without any extra setup. It consists of:

- `src/app/manifest.ts`: name, icons, theme colour and standalone display.
- `public/icons/*`: generated from SVG with `npm run icons`.
- `public/sw.js`: offline fallback page (`/offline`), push display and notification-click deep links.

The service worker registers in production builds. To test it in development, set `NEXT_PUBLIC_ENABLE_SW_IN_DEV=1`.

Installing on iPhone/iPad: Safari → Share → **Add to Home Screen**. Web Push on iOS works only from the installed app (iOS 16.4+).

## Push notification setup

1. Generate keys with `npx web-push generate-vapid-keys`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
3. Each user opens **Profile → Mobile notifications → Enable mobile notifications**. The browser asks for permission only at that point, never on page load.
4. Users can register several devices, remove any of them and send themselves a test notification.

Push deliveries are sent right after the triggering action, and retried by the scheduler. See [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md).

## Scheduler setup

`GET /api/cron/reminders` with the header `Authorization: Bearer $CRON_SECRET` runs one tick:

1. It creates due 25-hour reminders.
2. It delivers queued push notifications.

A tick is idempotent, so it is safe to call as often as you like. Choose one or more triggers:

| Option                                                               | Frequency                                                         | Setup                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **GitHub Actions** (`.github/workflows/reminders.yml`) — recommended | every 15 min                                                      | add repository secrets `APP_URL` and `CRON_SECRET`                       |
| **Supabase pg_cron** (`supabase/scheduler/pg_cron.sql`)              | every 10 min                                                      | enable `pg_cron` and `pg_net`, store the secret in Vault, run the script |
| **Vercel Cron** (`vercel.json`)                                      | daily at 06:00 IST (Hobby limit); change to `*/15 * * * *` on Pro | set `CRON_SECRET` in Vercel; Vercel sends it automatically               |

**Local manual run**, which is safe to repeat:

```bash
npm run reminders:run
npm run reminders:run -- --now=2026-10-11T06:00:00+05:30   # simulate a moment in IST
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

## Deployment

Step-by-step instructions, the full variable list and the smoke-test checklist are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short:

```bash
npx supabase login && npx supabase link --project-ref <ref>
npx supabase db push                        # apply migrations (do NOT run seed.sql in production)
npx vercel link && npx vercel env add …     # add each variable from the table above
npx vercel --prod
```

Then bootstrap the first administrator (see DEPLOYMENT.md) and configure the scheduler.

## Roles and permissions

| Capability                                                       | Administrator | Teammate                                                            |
| ---------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| Read tournaments, teams, matches, participants (names only)      | ✅            | ✅ (approved accounts only)                                         |
| Manage tournaments, enrolments, teams, squads, venues, opponents | ✅            | ❌                                                                  |
| Create a match                                                   | ✅            | ✅ only for their own team; they are auto-included and cannot leave |
| Edit a match                                                     | ✅ everything | ✅ basic details of matches they created                            |
| Cancel / delete a match                                          | ✅            | ❌ cancel; delete only their own match before anyone else joins     |
| Set own availability (Available/Maybe/Unavailable/Confirmed)     | ✅            | ✅                                                                  |
| Set others' status, finalise Playing XI, add/remove players      | ✅            | ❌                                                                  |
| Replace a dummy opponent                                         | ✅            | ❌                                                                  |
| Approve users, change roles, deactivate accounts                 | ✅            | ❌                                                                  |
| View phone numbers                                               | ✅            | ❌ (their own only)                                                 |
| View audit history and delivery records                          | ✅            | ❌                                                                  |
| Push subscriptions                                               | own only      | own only                                                            |

The full matrix is in [docs/AUTHORIZATION_MATRIX.md](docs/AUTHORIZATION_MATRIX.md).

## How IST dates are handled

- **Inputs:** every date and time input is labelled “(IST)”. Values are interpreted in `Asia/Kolkata` whatever the timezone of the browser, server or database.
- **Matches:**
  - The database stores exactly what was entered: `match_date` (DATE), `start_time` / `reporting_time` (TIME) and `timezone = 'Asia/Kolkata'` (enforced by a CHECK constraint).
  - A trigger derives `starts_at` and `reporting_at` (TIMESTAMPTZ) with `(match_date + start_time) AT TIME ZONE timezone`. Postgres does the conversion; the code never adds or subtracts 5h30m.
- **Tournaments:** dates are plain `DATE` values, so they never shift.
- **Display:** Luxon formats everything as `DD MMM YYYY, hh:mm a IST`, for example `12 Oct 2026, 07:00 AM IST`.
- **API responses:** they include `timezone: "Asia/Kolkata"`, `utcOffset: "+05:30"` and ISO timestamps such as `2026-10-12T07:00:00.000+05:30`.
- **Reminders:** the 25-hour window is `[starts_at − 25h, starts_at)`, computed on absolute instants.
- **Tests:** they run with `TZ=UTC` and with other host zones. Playwright runs the browser in `America/New_York`. Midnight edge cases are covered.

## Troubleshooting

| Symptom                                                  | Fix                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing required environment variable`                  | Create `.env.local` from `.env.example`, then restart `npm run dev`.                                                                            |
| Sign-in works but every page says “Waiting for approval” | An administrator must approve the account under **Administration → Users & roles**.                                                             |
| Integration tests fail to connect                        | Run `npm run db:start`, then check that `.env.local` matches `npx supabase status`.                                                             |
| E2E tests fail on seed names                             | Run `npm run db:reset` first; E2E tests expect fresh seed data.                                                                                 |
| Push button missing / “not configured”                   | Set both VAPID keys and restart. On iOS, install to the Home Screen first.                                                                      |
| Notifications blocked                                    | Allow notifications in the browser's site settings, then reload the Profile page.                                                               |
| Reminders never arrive                                   | Check that the scheduler is calling `/api/cron/reminders` with the right `CRON_SECRET`, and check **Administration → Notification deliveries**. |
| `DUPLICATE_MATCH` error                                  | A matching fixture already exists. An administrator can tick “This is a separate, legitimate match”.                                            |

## Known limitations

- Web Push on iOS requires the app to be installed to the Home Screen (iOS 16.4+). Some browsers (for example in-app browsers) have no push support. In-app notifications always work.
- Reporting time must be on the same calendar day as the start time.
- The Vercel Hobby plan runs crons at most once a day. Use the GitHub Actions or pg_cron scheduler for timely reminders.
- The GitHub Actions schedule can be delayed by several minutes under load. The processing window tolerates this.
- There is no CricHeroes API integration (none is officially available). The link is maintained by hand.
- Email and WhatsApp notification channels are not included in V1. The delivery model allows adding them later.
- A browser's rotated push subscription (`pushsubscriptionchange`) is picked up the next time the user opens the Profile page. The expired endpoint is removed automatically.
