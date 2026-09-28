/**
 * Runs one scheduler tick locally: 25-hour reminders + push delivery.
 *
 *   npm run reminders:run                                  # uses the current time
 *   npm run reminders:run -- --now=2026-10-11T06:00:00+05:30  # simulate a time (IST offset)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and optional VAPID keys) from .env.local.
 * Re-running it is safe: reminders are deduplicated in the database.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { createWebPushSenderFromKeys } from "../src/lib/push/web-push-core";
import { runScheduledJobs } from "../src/lib/scheduler";

config({ path: ".env.local" });
config();

async function main() {
  const nowArg = process.argv.find((a) => a.startsWith("--now="))?.slice("--now=".length);
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now value: ${nowArg}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const sender = createWebPushSenderFromKeys({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    subject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  });
  const result = await runScheduledJobs(db, sender, now);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
