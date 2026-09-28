# Security and privacy

## Threat model (summary)

The public anon key and the PostgREST API are reachable by anyone; any signed-in user can craft requests. Therefore **authorization is enforced in Postgres** (RLS + triggers + restricted grants), with the same checks repeated in server actions/routes and reflected in the UI.

## Controls

| Area                | Control                                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication      | Supabase Auth (bcrypt password hashing, JWT sessions in cookies managed by `@supabase/ssr`); `auth.getUser()` validates the token server-side on every request; proxy refreshes sessions; generic "incorrect email or password"; password reset response doesn't reveal account existence; min password length 8 |
| Approval gating     | New accounts are `pending`; RLS helper `app.is_active()` denies all team data until an admin approves; role/status can't come from user metadata                                                                                                                                                                 |
| Authorization       | RLS on every table; privileged columns protected by triggers (mass-assignment protection even via direct API); least-privilege grants (no anon access, notifications writable only in `read_at`, append-only audit logs); scheduler RPCs executable by `service_role` only                                       |
| IDOR                | All object access filtered by RLS; server actions derive the acting user from the session, never from form input (e.g. profile updates use the session id)                                                                                                                                                       |
| Mass assignment     | Zod schemas whitelist fields; payloads are built column by column; DB triggers reject forbidden column changes                                                                                                                                                                                                   |
| CSRF                | Server Actions: built-in Origin check; JSON routes: same-origin check + JSON bodies; cookies SameSite=Lax                                                                                                                                                                                                        |
| XSS                 | React escaping everywhere, no `dangerouslySetInnerHTML`; CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`); URLs validated (`https:` only for CricHeroes/maps; relative-only deep links and redirects)                                                                                   |
| Secrets             | Server-only modules (`server-only` import guard) for service-role key, VAPID private key, cron secret; `.env*` git-ignored; `.env.example` placeholders only; build output checked for leaked secrets                                                                                                            |
| Cron endpoint       | `Authorization: Bearer CRON_SECRET` compared with `timingSafeEqual`; ≥16 chars required                                                                                                                                                                                                                          |
| Logging             | No logging of passwords, tokens, push endpoints/keys or phone numbers; delivery errors store only status code + error class                                                                                                                                                                                      |
| Transport / headers | HSTS (production), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader` off                                                                                                                                                                             |
| Push                | Payloads carry minimal info; service worker opens only same-origin paths; expired subscriptions removed                                                                                                                                                                                                          |

## Personal data

Collected: display name, email (from Auth), optional phone, team membership, match responses, push device endpoints, notification history. No real personal data in seed files (reserved `example.com` addresses, fictional names/numbers).

| Data                                       | Visible to                                              |
| ------------------------------------------ | ------------------------------------------------------- |
| Display name, role, squad, match responses | approved members                                        |
| Email, phone (`profile_private`)           | the user + administrators                               |
| Push subscriptions                         | the user only (not even administrators)                 |
| Notifications                              | the recipient (+ administrators for delivery oversight) |
| Audit history, delivery records            | administrators                                          |

## Account deactivation and deletion

- **Deactivate** (admin UI): status `inactive` → no access to any team data, push devices removed, history retained, reversible.
- **Delete** (Supabase dashboard → Authentication → Users → Delete, or `auth.admin.deleteUser`): cascades profile, private data, preferences, devices, memberships, responses and notifications; audit entries remain with the actor anonymised (`NULL`).
- Users can remove their own devices and phone number at any time from Profile.

## Retention

Matches are cancelled rather than deleted; tournaments with matches are archived. Audit logs are append-only; define an organisational retention period and prune as the database owner if needed (see DATA_MODEL.md).

## Reporting issues

Report vulnerabilities privately to the team administrators; do not open public issues containing exploit details.
