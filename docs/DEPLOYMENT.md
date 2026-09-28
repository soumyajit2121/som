# Deployment (Vercel + Supabase)

Nothing here has been run against a real account by the build agent — these are the exact steps to perform with your own credentials.

## 1. Supabase project

1. Create a project at <https://supabase.com/dashboard> (region: **Mumbai `ap-south-1`** for India).
2. Link and apply migrations from your machine:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies supabase/migrations/*; never run seed.sql in production
   ```
3. **Authentication → URL configuration**
   - Site URL: `https://<your-app>.vercel.app` (or custom domain)
   - Redirect URLs: `https://<your-app>.vercel.app/**`
4. **Authentication → Providers → Email**: enabled; "Confirm email" on (recommended); minimum password length 8.
5. **Authentication → SMTP**: configure a real SMTP provider for invites/password resets (Supabase's built-in sender is rate-limited).
6. Copy from **Project Settings → API**: Project URL, anon (or publishable) key, service_role (or secret) key.

### Bootstrap the first administrator

Sign up in the deployed app with your own email, then in **SQL Editor**:

```sql
update public.profiles
set status = 'active', role = 'admin'
where id = (select id from auth.users where email = 'you@your-domain.example');
```

After that, approve/promote everyone else from **Administration → Users & roles**.

## 2. Vercel project

```bash
npx vercel login
npx vercel link                      # create/link the project
# add each variable for Production (repeat for Preview if desired):
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel env add CRON_SECRET production
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
npx vercel env add VAPID_PRIVATE_KEY production
npx vercel env add VAPID_SUBJECT production
npx vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard (framework: Next.js, root: repository root, install: `npm ci`, build: `npm run build`) and add the variables under **Settings → Environment Variables**. `vercel.json` pins the Mumbai region (`bom1`).

### Environment variables (no values here)

| Name                            | Configure in                                                        | Secret      |
| ------------------------------- | ------------------------------------------------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel                                                              | no          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel                                                              | no (public) |
| `SUPABASE_SERVICE_ROLE_KEY`     | Vercel (Production/Preview only, never Development shared machines) | **yes**     |
| `NEXT_PUBLIC_SITE_URL`          | Vercel                                                              | no          |
| `CRON_SECRET`                   | Vercel **and** GitHub repo secret (and Supabase Vault if pg_cron)   | **yes**     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | Vercel                                                              | no          |
| `VAPID_PRIVATE_KEY`             | Vercel                                                              | **yes**     |
| `VAPID_SUBJECT`                 | Vercel                                                              | no          |
| `APP_URL`                       | GitHub repo secret (scheduler workflow)                             | no          |

Generate: `openssl rand -hex 32` (CRON_SECRET), `npx web-push generate-vapid-keys` (VAPID). Keep the same VAPID keys forever — changing them invalidates every device subscription.

## 3. Scheduler (pick at least one)

- **GitHub Actions (recommended)**: repository **Settings → Secrets and variables → Actions** → add `APP_URL` (e.g. `https://<your-app>.vercel.app`) and `CRON_SECRET`. The workflow `.github/workflows/reminders.yml` runs every 15 minutes; trigger once manually via **Actions → Reminder scheduler → Run workflow** to verify.
- **Supabase pg_cron**: Database → Extensions → enable `pg_cron`, `pg_net`; store the secret with `select vault.create_secret('<CRON_SECRET>', 'cron_secret');`; run `supabase/scheduler/pg_cron.sql` with your URL.
- **Vercel Cron**: already declared in `vercel.json` (daily 06:00 IST — the Hobby-plan maximum). On Pro, change the schedule to `*/15 * * * *`. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

## 4. CI

`.github/workflows/ci.yml` needs **no repository secrets**: it starts an ephemeral local Supabase stack with demo keys for integration and E2E tests. Recommended: protect the default branch and require the `CI` checks.

## 5. Production smoke test

1. `https://<app>/login` loads; security headers present (`curl -I`: `content-security-policy`, `x-frame-options: DENY`).
2. Sign in as the bootstrapped admin → dashboard shows "All times are India Standard Time (IST)" with the current IST time.
3. Create a tournament (enrol a team) and a tournament match for 07:00; match page shows `…, 07:00 AM IST`.
4. `curl -s -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders` → JSON summary; without the header → 401.
5. Create a practice match with a dummy opponent starting in ~3 hours; run the cron call; the admin sees a combined reminder in **Notifications** with a working link.
6. `https://<app>/manifest.webmanifest` returns JSON; Chrome DevTools → Application → Manifest shows installable; `/sw.js` is served.
7. Profile → Enable mobile notifications on a phone → Send a test notification → it arrives; tapping opens the app.

## 6. Rollback

`npx vercel rollback` (or promote a previous deployment in the dashboard). Database migrations are forward-only; write a new migration to revert schema changes.
