/**
 * 25-hour reminder and push delivery against the real database, with a
 * deterministic clock (no dependency on the current real time).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { istToInstant } from "@/lib/ist";
import { dispatchPush, type PushSender } from "@/lib/push/dispatch";
import { SupabasePushRepository } from "@/lib/push/supabase-repository";
import { processReminders } from "@/lib/reminders/process";
import { SupabaseReminderRepository } from "@/lib/reminders/supabase-repository";
import { runScheduledJobs } from "@/lib/scheduler";
import {
  createUser,
  createWorld,
  futureDate,
  insertMatch,
  serviceClient,
  type TestUser,
  type World,
} from "../support/fixtures";

let w: World;
let players: TestUser[] = [];
const service = serviceClient();
const repo = () => new SupabaseReminderRepository(service);

beforeAll(async () => {
  w = await createWorld();
  players = await Promise.all(Array.from({ length: 12 }, () => createUser()));
  await service.from("team_memberships").insert(players.map((p) => ({ team_id: w.teamId, profile_id: p.id })));
  // admin: push enabled with one device; admin2: push disabled.
  await service.from("push_subscriptions").insert({
    profile_id: w.admin.id,
    endpoint: `https://push.example.com/admin-${Date.now()}`,
    p256dh: "p".repeat(40),
    auth: "a".repeat(16),
  });
  await service.from("notification_preferences").update({ push_enabled: true }).eq("profile_id", w.admin.id);
  await service.from("notification_preferences").update({ push_enabled: false }).eq("profile_id", w.admin2.id);
});

afterAll(async () => {
  await w?.cleanup();
  for (const p of players) await service.auth.admin.deleteUser(p.id);
});

async function matchWith(confirmed: number, opts: { dummy?: boolean } = {}) {
  let opponentId = w.opponentId;
  if (opts.dummy) {
    const d = await service.rpc("create_dummy_opponent");
    opponentId = d.data!.id;
  }
  const date = futureDate();
  const { data, error } = await insertMatch(service, {
    our_team_id: w.teamId,
    opponent_id: opponentId,
    created_by: w.admin.id,
    match_date: date,
    start_time: "07:00",
    status: "scheduled",
  });
  if (error) throw error;
  if (confirmed) {
    await service
      .from("match_participants")
      .insert(
        players.slice(0, confirmed).map((p) => ({ match_id: data.id, profile_id: p.id, status: "confirmed" as const })),
      );
  }
  const startsAt = istToInstant(date, "07:00");
  // A deterministic "now": 24 hours before the start, i.e. inside the 25-hour window.
  const now = new Date(startsAt.getTime() - 24 * 3_600_000);
  return { id: data.id, now, startsAt };
}

async function adminNotifications(matchId: string, adminId = w.admin.id) {
  const { data } = await service
    .from("notifications")
    .select("id, type, body, link_path")
    .eq("match_id", matchId)
    .eq("recipient_id", adminId);
  return data ?? [];
}

describe("25-hour reminders", () => {
  it("fewer than 11 confirmed players triggers the insufficient-player reminder", async () => {
    const m = await matchWith(8);
    await processReminders(repo(), m.now);
    const n = await adminNotifications(m.id);
    expect(n).toHaveLength(1);
    expect(n[0].type).toBe("insufficient_players");
    expect(n[0].body).toContain("Only 8 of 11 players are confirmed");
    expect(n[0].body).toContain("07:00 AM IST");
    expect(n[0].body).toContain("Three more players are required");
  });

  it("exactly 11 confirmed players does not trigger the insufficient-player reminder", async () => {
    const m = await matchWith(11);
    await processReminders(repo(), m.now);
    expect(await adminNotifications(m.id)).toHaveLength(0);
  });

  it("a dummy opponent triggers the CricHeroes reminder even with a full squad", async () => {
    const m = await matchWith(12, { dummy: true });
    await processReminders(repo(), m.now);
    const n = await adminNotifications(m.id);
    expect(n.map((x) => x.type)).toEqual(["dummy_opponent"]);
    expect(n[0].body).toContain("CricHeroes");
  });

  it("both conditions create a single combined reminder per administrator", async () => {
    const m = await matchWith(4, { dummy: true });
    await processReminders(repo(), m.now);
    const n = await adminNotifications(m.id);
    expect(n.map((x) => x.type)).toEqual(["readiness_alert"]);
    const n2 = await adminNotifications(m.id, w.admin2.id);
    expect(n2).toHaveLength(1);
  });

  it("does not fire before the 25-hour mark", async () => {
    const m = await matchWith(2);
    await processReminders(repo(), new Date(m.startsAt.getTime() - 26 * 3_600_000));
    expect(await adminNotifications(m.id)).toHaveLength(0);
  });

  it("repeated scheduler runs do not create duplicates", async () => {
    const m = await matchWith(5);
    for (let i = 0; i < 4; i++) {
      await processReminders(repo(), new Date(m.now.getTime() + i * 15 * 60_000));
    }
    expect(await adminNotifications(m.id)).toHaveLength(1);
    const ledger = await service
      .from("reminder_deliveries")
      .select("id")
      .eq("match_id", m.id)
      .eq("recipient_id", w.admin.id);
    expect(ledger.data).toHaveLength(1);
  });

  it("reminders are not sent to teammates", async () => {
    const m = await matchWith(3);
    await processReminders(repo(), m.now);
    const { data } = await service
      .from("notifications")
      .select("id")
      .eq("match_id", m.id)
      .eq("recipient_id", players[0].id);
    expect(data).toEqual([]);
  });

  it("a notification link opens the correct match", async () => {
    const m = await matchWith(1);
    await processReminders(repo(), m.now);
    const [n] = await adminNotifications(m.id);
    expect(n.link_path).toBe(`/matches/${m.id}`);
  });
});

describe("push delivery", () => {
  it("a push-enabled administrator receives a push-delivery attempt; a push-disabled one does not", async () => {
    const m = await matchWith(6);
    await processReminders(repo(), m.now);
    const [enabled] = await adminNotifications(m.id, w.admin.id);
    const [disabled] = await adminNotifications(m.id, w.admin2.id);
    const d1 = await service
      .from("notification_deliveries")
      .select("channel, status")
      .eq("notification_id", enabled.id);
    const d2 = await service.from("notification_deliveries").select("id").eq("notification_id", disabled.id);
    expect(d1.data).toEqual([{ channel: "web_push", status: "pending" }]);
    expect(d2.data).toEqual([]);

    const sent: string[] = [];
    const sender: PushSender = {
      configured: true,
      async send(_sub, payload) {
        sent.push(payload.url);
        return { statusCode: 201 };
      },
    };
    await dispatchPush(new SupabasePushRepository(service), sender, m.now);
    expect(sent).toContain(`/matches/${m.id}`);
    const after = await service
      .from("notification_deliveries")
      .select("status, attempts")
      .eq("notification_id", enabled.id)
      .single();
    expect(after.data).toEqual({ status: "sent", attempts: 1 });
  });

  it("in-app notification survives when push delivery fails, and the retry is bounded", async () => {
    const m = await matchWith(7);
    const failing: PushSender = {
      configured: true,
      async send() {
        throw Object.assign(new Error("gateway"), { statusCode: 503 });
      },
    };
    const result = await runScheduledJobs(service, failing, m.now);
    expect(result.reminders.errors).toEqual([]);
    const [n] = await adminNotifications(m.id);
    expect(n).toBeDefined();
    const d = await service
      .from("notification_deliveries")
      .select("status, attempts, next_attempt_at")
      .eq("notification_id", n.id)
      .single();
    expect(d.data?.status).toBe("failed_temporary");

    // Retries happen only after the back-off, and stop at max_attempts.
    let t = m.now.getTime();
    for (let i = 0; i < 5; i++) {
      t += 60 * 60_000;
      await dispatchPush(new SupabasePushRepository(service), failing, new Date(t));
    }
    const final = await service
      .from("notification_deliveries")
      .select("status, attempts")
      .eq("notification_id", n.id)
      .single();
    expect(final.data).toEqual({ status: "failed_permanent", attempts: 3 });
    const still = await adminNotifications(m.id);
    expect(still).toHaveLength(1);
  });

  it("expired subscriptions are removed", async () => {
    const sub = await service
      .from("push_subscriptions")
      .insert({
        profile_id: w.admin2.id,
        endpoint: `https://push.example.com/gone-${Date.now()}`,
        p256dh: "p".repeat(40),
        auth: "a".repeat(16),
      })
      .select("id")
      .single();
    await service.from("notification_preferences").update({ push_enabled: true }).eq("profile_id", w.admin2.id);
    await service.from("notifications").insert({ recipient_id: w.admin2.id, type: "test", title: "t", body: "b" });
    const gone: PushSender = {
      configured: true,
      async send() {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      },
    };
    await dispatchPush(new SupabasePushRepository(service), gone, new Date());
    const check = await service.from("push_subscriptions").select("id").eq("id", sub.data!.id);
    expect(check.data).toEqual([]);
    await service.from("notification_preferences").update({ push_enabled: false }).eq("profile_id", w.admin2.id);
  });
});
