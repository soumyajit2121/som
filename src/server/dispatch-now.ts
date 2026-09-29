import "server-only";
import { after } from "next/server";
import { dispatchPush } from "@/lib/push/dispatch";
import { SupabasePushRepository } from "@/lib/push/supabase-repository";
import { createWebPushSender } from "@/lib/push/web-push-sender";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delivers queued push notifications right after the response is sent, so
 * users don't wait for the next scheduler tick. Failures are left for the
 * scheduler to retry. The in-app notification already exists either way.
 */
export function dispatchPushSoon() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(async () => {
    try {
      await dispatchPush(new SupabasePushRepository(createAdminClient()), createWebPushSender(), new Date(), 50);
    } catch {
      // Swallowed on purpose: the scheduler retries pending deliveries.
    }
  });
}
