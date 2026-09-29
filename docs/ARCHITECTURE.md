# Architecture

## Overview

```
┌──────────────────────────── Browser / installed PWA ────────────────────────────┐
│ React Server Component HTML, small client components (forms, push opt-in)       │
│ public/sw.js — offline fallback, push display, notificationclick deep links     │
└───────────────┬──────────────────────────────────────────────────────────────────┘
                │ HTTPS (cookies: Supabase session, httpOnly-by-SSR, SameSite=Lax)
┌───────────────▼──────────── Next.js 16 on Vercel (Node runtime) ────────────────┐
│ src/proxy.ts            refresh session cookie, redirect signed-out visitors     │
│ (app)/layout.tsx        requireActiveSession(): approved accounts only           │
│ Server Components       read via Supabase client bound to the user's JWT         │
│ Server Actions          Zod validation → explicit column mapping → Supabase      │
│ /api/matches, /api/players, /api/me, /api/push/subscriptions   JSON API          │
│ /api/cron/reminders     Bearer CRON_SECRET → service-role client → scheduler     │
└───────────────┬───────────────────────────────┬──────────────────────────────────┘
                │ user JWT (anon key)           │ service-role key (server only)
┌───────────────▼───────────────────────────────▼──────────────────────────────────┐
│ Supabase: Auth (GoTrue) · PostgREST · Postgres 17                                │
│   RLS policies · business-rule triggers · audit triggers · notification fan-out  │
│   RPCs: create_dummy_opponent, post_announcement, send_test_notification,        │
│         record_reminder (service), claim_push_deliveries (service)               │
└──────────────────────────────────────────────────────────────────────────────────┘
Scheduler: GitHub Actions (*/15) │ pg_cron + pg_net │ Vercel Cron  →  /api/cron/reminders
```

## Request flow (example: teammate sets availability)

1. Button in `MyResponse` submits FormData to `setParticipationAction` (server action; Next.js checks Origin).
2. Action loads the session (`getActiveSession` → `auth.getUser()` validates the JWT with Supabase Auth), parses with Zod.
3. `setParticipation` service refuses other profiles / `playing` for teammates (friendly error).
4. Supabase update runs **as the user**; RLS (`participants_update`) and trigger `participants_before_write` enforce the same rule in the database.
5. Trigger `participants_after_confirm_notify` inserts in-app notifications for admins; `notifications_after_insert_queue_push` queues push deliveries; `dispatchPushSoon()` sends them after the response (`after()`).

## Why business rules live in the database

The anon key is public by design, so anyone can call PostgREST directly with their own JWT. RLS + triggers make the rules hold for every client: the Next.js UI, the JSON API, or a hand-crafted request. Server-side checks in actions exist for good error messages and defence in depth.

## Key modules

| Module                         | Responsibility                                                           |
| ------------------------------ | ------------------------------------------------------------------------ |
| `src/lib/ist.ts`               | Only place that converts/format dates (Luxon, `Asia/Kolkata`)            |
| `src/lib/auth.ts`              | Session + profile loading, `requireActiveSession`, `requireAdminSession` |
| `src/lib/data/*`               | Read models (`match_overview` view → `MatchSummary`), JSON serializers   |
| `src/lib/reminders/engine.ts`  | Pure 25-hour rules + message text                                        |
| `src/lib/reminders/process.ts` | Idempotent orchestration over a repository interface                     |
| `src/lib/push/dispatch.ts`     | Delivery attempts, error classification, retry backoff                   |
| `src/lib/scheduler.ts`         | One scheduler tick (reminders, then push)                                |
| `src/server/actions/*`         | All mutations                                                            |

## Technology decisions

- **Supabase SSR client on the server only**: the browser never talks to Supabase directly, so CSP `connect-src 'self'` holds and tokens stay in cookies.
- **Luxon** over manual `Date` math: IANA zone support without depending on the host TZ.
- **Hand-written service worker** instead of a PWA plugin: small, auditable, Turbopack-compatible.
- **GitHub Actions scheduler** as the default because Vercel Hobby cron is daily-only; the endpoint is scheduler-agnostic.
