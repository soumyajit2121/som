@AGENTS.md

# Cricket Team Manager — working notes

## Architecture

Next.js 16 App Router (Node runtime) + Supabase (Auth, Postgres 17 with RLS). Users' requests run under their own JWT (`src/lib/supabase/server.ts`); the service-role client (`src/lib/supabase/admin.ts`) is only for the scheduler and admin invites. Business rules live in Postgres (triggers/RLS) **and** are mirrored in server actions for friendly errors.

## Layout

- `supabase/migrations/` schema, triggers, RLS, RPCs · `supabase/seed.sql` fictional demo data
- `src/app/(auth)` public auth pages · `src/app/(app)` signed-in pages (layout enforces approval) · `src/app/api` JSON + cron routes
- `src/server/actions/*` server actions (`"use server"`) · `src/server/services/*` shared server logic
- `src/lib/ist.ts` all date/time logic · `src/lib/validation/schemas.ts` Zod schemas (client + server)
- `src/lib/reminders/*` 25h reminder engine (pure) + repository · `src/lib/push/*` web-push dispatch
- `src/components/ui` primitives · `src/components/*` feature components · `public/sw.js` service worker
- `tests/unit` (no DB) · `tests/integration` (local Supabase) · `tests/e2e` (Playwright)

## Commands

`npm run dev` · `npm run db:start` / `db:reset` / `db:types` · `npm run lint` · `npm run typecheck` · `npm run format` · `npm test` · `npm run test:integration` · `npm run test:e2e` · `npm run build` · `npm run reminders:run [-- --now=ISO]`

## Conventions

- TypeScript strict; Prettier (120 cols); Tailwind utility classes; server components by default, `"use client"` only for interactivity.
- Forms: client component + `useValidatedAction(action, schema)`; server action re-validates with the same Zod schema and returns `ActionResult`.
- Build DB payloads field by field from parsed input (never spread raw form data) — prevents mass assignment.
- Map DB errors with `friendlyDbError`; never show raw database messages.
- After changing SQL: add a **new** migration (don't edit applied ones in shared environments), run `npm run db:reset`, then `npm run db:types`.

## Security rules

- Never commit secrets; `.env.example` holds placeholders only. Never prefix secrets with `NEXT_PUBLIC_`.
- Never import `server-env`, `supabase/admin` or `web-push-sender` from client code (`server-only` guards this).
- Don't log tokens, passwords, push endpoints/keys or phone numbers.
- Phone/email live in `profile_private` (owner + admin only). Push subscriptions are owner-only, even for admins.
- Deep links / redirects go through `safeRelativePath`.

## Authorization rules (enforced in UI, server, and DB)

Admins manage everything. Teammates: read shared data; edit own profile; set own participation (not `playing`); create matches only for their team (auto-included, can't leave); edit basic fields of matches they created; delete own match only before others join. Pending/inactive users see nothing. See `docs/AUTHORIZATION_MATRIX.md`.

## IST rules

Business zone is `Asia/Kolkata`. Use `src/lib/ist.ts` only — never `new Date(y, m, d)`, `toLocaleString` without zone, or manual +5:30 arithmetic. Matches store `match_date` + `start_time` + `timezone`; `starts_at` is derived in the DB. Display format `DD MMM YYYY, hh:mm a IST`. APIs return `+05:30` ISO strings. Reminder tests must use injected clocks.

## Done checklist

- [ ] `npm run format:check && npm run lint && npm run typecheck` clean
- [ ] `npm test` and (with local Supabase) `npm run test:integration` pass; E2E for UI flows
- [ ] New authorization rules have a direct-API (PostgREST) test proving teammates can't bypass them
- [ ] `npm run build` passes; no secrets in `.next/static`
- [ ] Docs updated (README / docs/*) when behaviour or env vars change
