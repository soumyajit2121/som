import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClaimedDelivery, DeliveryOutcome, PushRepository } from "./dispatch";

/** Push delivery repository backed by Supabase. Requires a service-role client. */
export class SupabasePushRepository implements PushRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async claim(limit: number, now: Date): Promise<ClaimedDelivery[]> {
    const { data, error } = await this.db.rpc("claim_push_deliveries", {
      p_limit: limit,
      p_now: now.toISOString(),
    });
    if (error) throw new Error(`Failed to claim deliveries: ${error.message}`);
    return (data ?? []).map((row) => ({
      deliveryId: row.delivery_id,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      subscription: row.subscription_id
        ? { id: row.subscription_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }
        : null,
      notification: {
        id: row.notification_id,
        type: row.notification_type,
        title: row.title,
        body: row.body,
        linkPath: row.link_path,
      },
    }));
  }

  async complete(deliveryId: string, outcome: DeliveryOutcome, now: Date): Promise<void> {
    const update: Database["public"]["Tables"]["notification_deliveries"]["Update"] = {
      status: outcome.status,
      last_attempt_at: now.toISOString(),
      response_code: "responseCode" in outcome ? outcome.responseCode : null,
      last_error: "error" in outcome ? outcome.error : null,
    };
    if (outcome.status === "failed_temporary") update.next_attempt_at = outcome.nextAttemptAt.toISOString();
    const { error } = await this.db.from("notification_deliveries").update(update).eq("id", deliveryId);
    if (error) throw new Error(`Failed to update delivery: ${error.message}`);
  }

  async removeSubscription(subscriptionId: string): Promise<void> {
    await this.db.from("push_subscriptions").delete().eq("id", subscriptionId);
  }

  async markSubscriptionSuccess(subscriptionId: string, now: Date): Promise<void> {
    await this.db
      .from("push_subscriptions")
      .update({ last_success_at: now.toISOString(), failure_count: 0 })
      .eq("id", subscriptionId);
  }
}
