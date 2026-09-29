/**
 * Web-push delivery with bounded retries.
 *
 * - 404 / 410          → subscription expired: removed, delivery "expired"
 * - 408 / 429 / 5xx /
 *   network errors     → temporary: retried with exponential backoff
 * - other 4xx          → permanent failure
 *
 * The in-app notification row is never touched, so it stays available
 * whatever happens here.
 */
import type { NotificationType } from "@/lib/labels";
import { buildPushPayload, type PushPayload } from "./payload";

export interface ClaimedDelivery {
  deliveryId: string;
  attempts: number;
  maxAttempts: number;
  subscription: { id: string; endpoint: string; p256dh: string; auth: string } | null;
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    linkPath: string | null;
  };
}

export type DeliveryOutcome =
  | { status: "sent"; responseCode: number }
  | { status: "expired"; responseCode: number; error: string }
  | { status: "failed_temporary"; responseCode: number | null; error: string; nextAttemptAt: Date }
  | { status: "failed_permanent"; responseCode: number | null; error: string }
  | { status: "skipped"; error: string };

export interface PushRepository {
  claim(limit: number, now: Date): Promise<ClaimedDelivery[]>;
  complete(deliveryId: string, outcome: DeliveryOutcome, now: Date): Promise<void>;
  removeSubscription(subscriptionId: string): Promise<void>;
  markSubscriptionSuccess(subscriptionId: string, now: Date): Promise<void>;
}

export interface PushSender {
  readonly configured: boolean;
  send(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<{ statusCode: number }>;
}

export type FailureClass = "expired" | "temporary" | "permanent";

export function classifyPushError(error: unknown): { kind: FailureClass; statusCode: number | null } {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : null;
  if (statusCode === null || Number.isNaN(statusCode)) return { kind: "temporary", statusCode: null };
  if (statusCode === 404 || statusCode === 410) return { kind: "expired", statusCode };
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) return { kind: "temporary", statusCode };
  return { kind: "permanent", statusCode };
}

/** 2, 4, 8 ... minutes */
export function backoffDelayMs(attempt: number): number {
  return Math.min(2 ** attempt, 60) * 60_000;
}

/** Short, sanitised error text. Never includes the endpoint or keys. */
function safeError(error: unknown, statusCode: number | null): string {
  const base = statusCode ? `Push service responded with ${statusCode}` : "Network error";
  const name = error instanceof Error ? error.name : "Error";
  return `${base} (${name})`.slice(0, 300);
}

export interface DispatchSummary {
  claimed: number;
  sent: number;
  expired: number;
  retryScheduled: number;
  failed: number;
  skipped: number;
}

export async function dispatchPush(
  repo: PushRepository,
  sender: PushSender,
  now: Date,
  limit = 100,
): Promise<DispatchSummary> {
  const summary: DispatchSummary = { claimed: 0, sent: 0, expired: 0, retryScheduled: 0, failed: 0, skipped: 0 };
  const deliveries = await repo.claim(limit, now);
  summary.claimed = deliveries.length;

  for (const d of deliveries) {
    let outcome: DeliveryOutcome;
    if (!d.subscription) {
      outcome = { status: "skipped", error: "Device was removed" };
    } else if (!sender.configured) {
      outcome = { status: "skipped", error: "Web push is not configured on the server" };
    } else {
      try {
        const res = await sender.send(d.subscription, buildPushPayload(d.notification));
        outcome = { status: "sent", responseCode: res.statusCode };
      } catch (error) {
        const { kind, statusCode } = classifyPushError(error);
        const message = safeError(error, statusCode);
        if (kind === "expired") {
          outcome = { status: "expired", responseCode: statusCode!, error: message };
        } else if (kind === "temporary" && d.attempts < d.maxAttempts) {
          outcome = {
            status: "failed_temporary",
            responseCode: statusCode,
            error: message,
            nextAttemptAt: new Date(now.getTime() + backoffDelayMs(d.attempts)),
          };
        } else {
          outcome = { status: "failed_permanent", responseCode: statusCode, error: message };
        }
      }
    }

    try {
      await repo.complete(d.deliveryId, outcome, now);
      if (outcome.status === "expired" && d.subscription) {
        await repo.removeSubscription(d.subscription.id);
      }
      if (outcome.status === "sent" && d.subscription) {
        await repo.markSubscriptionSuccess(d.subscription.id, now);
      }
    } catch {
      // Continue with the remaining deliveries; a stale claim is retried later.
    }

    if (outcome.status === "sent") summary.sent++;
    else if (outcome.status === "expired") summary.expired++;
    else if (outcome.status === "failed_temporary") summary.retryScheduled++;
    else if (outcome.status === "failed_permanent") summary.failed++;
    else summary.skipped++;
  }
  return summary;
}
