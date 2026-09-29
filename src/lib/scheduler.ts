import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { dispatchPush, type DispatchSummary, type PushSender } from "@/lib/push/dispatch";
import { SupabasePushRepository } from "@/lib/push/supabase-repository";
import { processReminders, type ReminderRunSummary } from "@/lib/reminders/process";
import { SupabaseReminderRepository } from "@/lib/reminders/supabase-repository";

export interface ScheduledRunResult {
  now: string;
  reminders: ReminderRunSummary;
  push: DispatchSummary;
}

/** One scheduler tick: create due reminders, then deliver queued push notifications. */
export async function runScheduledJobs(
  db: SupabaseClient<Database>,
  sender: PushSender,
  now: Date,
): Promise<ScheduledRunResult> {
  const reminders = await processReminders(new SupabaseReminderRepository(db), now);
  const push = await dispatchPush(new SupabasePushRepository(db), sender, now);
  return { now: now.toISOString(), reminders, push };
}
