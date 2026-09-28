-- Optional alternative scheduler: run inside Supabase with pg_cron + pg_net.
-- Not a migration (it contains deployment-specific values). Run it once in the
-- Supabase SQL editor after enabling the pg_cron and pg_net extensions, with
-- the placeholders replaced. The secret is stored in Supabase Vault.

-- select vault.create_secret('<CRON_SECRET>', 'cron_secret');

select cron.schedule(
  'cricket-reminders-every-10-minutes',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://<your-app>.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);

-- To remove: select cron.unschedule('cricket-reminders-every-10-minutes');
