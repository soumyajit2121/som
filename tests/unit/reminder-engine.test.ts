import { describe, expect, it } from "vitest";
import { istToInstant } from "@/lib/ist";
import { buildReminderMessage, evaluateReminder, type ReminderMatch } from "@/lib/reminders/engine";

const startsAt = istToInstant("2026-10-12", "07:00").toISOString();
const inWindow = new Date("2026-10-11T06:00:00Z"); // ~19.5h before start
const tooEarly = new Date("2026-10-10T12:00:00Z");

function match(overrides: Partial<ReminderMatch> = {}): ReminderMatch {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "League Match",
    ourTeamName: "Team A",
    opponentName: "Team B",
    opponentIsDummy: false,
    startsAt,
    confirmedCount: 8,
    status: "scheduled",
    ...overrides,
  };
}

describe("evaluateReminder", () => {
  it("fewer than 11 confirmed players triggers the insufficient-player reminder", () => {
    expect(evaluateReminder(match({ confirmedCount: 10 }), inWindow)).toEqual({
      due: true,
      conditions: ["insufficient_players"],
    });
  });

  it("exactly 11 confirmed players does not trigger it", () => {
    expect(evaluateReminder(match({ confirmedCount: 11 }), inWindow)).toEqual({ due: false, conditions: [] });
  });

  it("more than 11 confirmed players is allowed and does not trigger it", () => {
    expect(evaluateReminder(match({ confirmedCount: 15 }), inWindow).due).toBe(false);
  });

  it("a dummy opponent triggers the CricHeroes reminder", () => {
    expect(evaluateReminder(match({ confirmedCount: 12, opponentIsDummy: true }), inWindow).conditions).toEqual([
      "dummy_opponent",
    ]);
  });

  it("a real opponent does not trigger the dummy-opponent reminder", () => {
    expect(evaluateReminder(match({ confirmedCount: 12, opponentIsDummy: false }), inWindow).conditions).toEqual([]);
  });

  it("both conditions are reported together", () => {
    expect(evaluateReminder(match({ confirmedCount: 3, opponentIsDummy: true }), inWindow).conditions).toEqual([
      "insufficient_players",
      "dummy_opponent",
    ]);
  });

  it("is not due before the 25-hour mark or for cancelled/completed matches", () => {
    expect(evaluateReminder(match(), tooEarly).due).toBe(false);
    expect(evaluateReminder(match({ status: "cancelled" }), inWindow).due).toBe(false);
    expect(evaluateReminder(match({ status: "completed" }), inWindow).due).toBe(false);
  });
});

describe("buildReminderMessage", () => {
  it("states the confirmed count, the number needed, the IST time and links to the match", () => {
    const msg = buildReminderMessage(match(), ["insufficient_players"]);
    expect(msg.type).toBe("insufficient_players");
    expect(msg.body).toBe(
      "Only 8 of 11 players are confirmed for Team A vs Team B on 12 Oct 2026 at 07:00 AM IST. Three more players are required.",
    );
    expect(msg.linkPath).toBe("/matches/11111111-1111-4111-8111-111111111111");
  });

  it("uses singular wording for one missing player", () => {
    expect(buildReminderMessage(match({ confirmedCount: 10 }), ["insufficient_players"]).body).toContain(
      "One more player is required.",
    );
  });

  it("asks to replace the placeholder and update CricHeroes", () => {
    const msg = buildReminderMessage(match({ opponentName: "Dummy Team 001", opponentIsDummy: true }), [
      "dummy_opponent",
    ]);
    expect(msg.body).toBe(
      "Team A vs Dummy Team 001 is scheduled for 12 Oct 2026 at 07:00 AM IST. Replace the placeholder opponent and create or update the match in CricHeroes.",
    );
  });

  it("creates one combined notification stating both actions", () => {
    const msg = buildReminderMessage(match({ opponentIsDummy: true, opponentName: "Dummy Team 001" }), [
      "insufficient_players",
      "dummy_opponent",
    ]);
    expect(msg.type).toBe("readiness_alert");
    expect(msg.body).toContain("Only 8 of 11 players are confirmed");
    expect(msg.body).toContain("three more players are required");
    expect(msg.body).toContain("create or update the match in CricHeroes");
  });
});
