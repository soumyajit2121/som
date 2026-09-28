import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  classifyPushError,
  dispatchPush,
  type ClaimedDelivery,
  type DeliveryOutcome,
  type PushRepository,
  type PushSender,
} from "@/lib/push/dispatch";
import { buildPushPayload } from "@/lib/push/payload";

class MemoryPushRepo implements PushRepository {
  outcomes = new Map<string, DeliveryOutcome>();
  removed: string[] = [];
  succeeded: string[] = [];
  constructor(private deliveries: ClaimedDelivery[]) {}
  async claim() {
    return this.deliveries;
  }
  async complete(id: string, outcome: DeliveryOutcome) {
    this.outcomes.set(id, outcome);
  }
  async removeSubscription(id: string) {
    this.removed.push(id);
  }
  async markSubscriptionSuccess(id: string) {
    this.succeeded.push(id);
  }
}

function delivery(id: string, attempts = 1): ClaimedDelivery {
  return {
    deliveryId: id,
    attempts,
    maxAttempts: 3,
    subscription: {
      id: `sub-${id}`,
      endpoint: "https://push.example.com/abc",
      p256dh: "k".repeat(20),
      auth: "a".repeat(10),
    },
    notification: {
      id: `n-${id}`,
      type: "insufficient_players",
      title: "Not enough players",
      body: "8 of 11",
      linkPath: "/matches/x",
    },
  };
}

const failingWith = (statusCode?: number): PushSender => ({
  configured: true,
  async send() {
    throw Object.assign(new Error("push failed"), statusCode ? { statusCode } : {});
  },
});
const now = new Date("2026-10-11T02:00:00Z");

describe("classifyPushError", () => {
  it("classifies expiry, temporary and permanent failures", () => {
    expect(classifyPushError({ statusCode: 410 }).kind).toBe("expired");
    expect(classifyPushError({ statusCode: 404 }).kind).toBe("expired");
    expect(classifyPushError({ statusCode: 429 }).kind).toBe("temporary");
    expect(classifyPushError({ statusCode: 503 }).kind).toBe("temporary");
    expect(classifyPushError(new Error("ECONNRESET")).kind).toBe("temporary");
    expect(classifyPushError({ statusCode: 400 }).kind).toBe("permanent");
  });
});

describe("dispatchPush", () => {
  it("records a successful push-delivery attempt", async () => {
    const repo = new MemoryPushRepo([delivery("d1")]);
    const sent: unknown[] = [];
    const sender: PushSender = { configured: true, send: async (_s, p) => (sent.push(p), { statusCode: 201 }) };
    const summary = await dispatchPush(repo, sender, now);
    expect(summary.sent).toBe(1);
    expect(repo.outcomes.get("d1")).toEqual({ status: "sent", responseCode: 201 });
    expect(sent).toHaveLength(1);
  });

  it("schedules a bounded retry for temporary failures", async () => {
    const repo = new MemoryPushRepo([delivery("d1", 1)]);
    await dispatchPush(repo, failingWith(503), now);
    const outcome = repo.outcomes.get("d1");
    expect(outcome?.status).toBe("failed_temporary");
    if (outcome?.status === "failed_temporary") {
      expect(outcome.nextAttemptAt.getTime() - now.getTime()).toBe(backoffDelayMs(1));
    }
  });

  it("stops retrying after the maximum number of attempts", async () => {
    const repo = new MemoryPushRepo([delivery("d1", 3)]);
    await dispatchPush(repo, failingWith(503), now);
    expect(repo.outcomes.get("d1")?.status).toBe("failed_permanent");
  });

  it("removes expired subscriptions", async () => {
    const repo = new MemoryPushRepo([delivery("d1")]);
    await dispatchPush(repo, failingWith(410), now);
    expect(repo.outcomes.get("d1")?.status).toBe("expired");
    expect(repo.removed).toEqual(["sub-d1"]);
  });

  it("never records the endpoint in error text", async () => {
    const repo = new MemoryPushRepo([delivery("d1")]);
    await dispatchPush(repo, failingWith(400), now);
    const outcome = repo.outcomes.get("d1");
    expect(JSON.stringify(outcome)).not.toContain("push.example.com");
  });

  it("skips delivery when web push is not configured", async () => {
    const repo = new MemoryPushRepo([delivery("d1")]);
    await dispatchPush(repo, { configured: false, send: async () => ({ statusCode: 201 }) }, now);
    expect(repo.outcomes.get("d1")?.status).toBe("skipped");
  });

  it("continues with other deliveries after a failure", async () => {
    const repo = new MemoryPushRepo([delivery("d1"), delivery("d2")]);
    let calls = 0;
    const sender: PushSender = {
      configured: true,
      async send() {
        calls++;
        if (calls === 1) throw Object.assign(new Error("x"), { statusCode: 500 });
        return { statusCode: 201 };
      },
    };
    const summary = await dispatchPush(repo, sender, now);
    expect(summary).toMatchObject({ claimed: 2, sent: 1, retryScheduled: 1 });
  });
});

describe("buildPushPayload", () => {
  it("opens the relevant match and never leaks another player's name", () => {
    const p = buildPushPayload({
      id: "n1",
      type: "player_confirmed",
      title: "Player confirmed",
      body: "Aarav Demo confirmed for League Match.",
      linkPath: "/matches/abc",
    });
    expect(p.url).toBe("/matches/abc");
    expect(p.body).not.toContain("Aarav");
  });

  it("rejects off-site deep links", () => {
    expect(buildPushPayload({ id: "n", type: "test", title: "t", body: "b", linkPath: "//evil.example" }).url).toBe(
      "/notifications",
    );
  });
});
