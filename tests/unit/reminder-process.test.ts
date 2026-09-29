import { describe, expect, it } from "vitest";
import { istToInstant } from "@/lib/ist";
import type { ReminderMatch } from "@/lib/reminders/engine";
import { processReminders, type RecordReminderInput, type ReminderRepository } from "@/lib/reminders/process";

class MemoryRepo implements ReminderRepository {
  ledger = new Map<string, RecordReminderInput>();
  constructor(
    public matches: ReminderMatch[],
    public admins: string[],
    private failFor: string[] = [],
  ) {}
  async listCandidateMatches(now: Date, until: Date) {
    return this.matches.filter((m) => new Date(m.startsAt) > now && new Date(m.startsAt) <= until);
  }
  async listAdminRecipientIds() {
    return this.admins;
  }
  async recordReminder(input: RecordReminderInput) {
    if (this.failFor.includes(input.matchId)) throw new Error("database unavailable");
    const key = [input.matchId, input.recipientId, input.reminderKind, input.occurrence].join("|");
    if (this.ledger.has(key)) return null;
    this.ledger.set(key, input);
    return `n-${this.ledger.size}`;
  }
}

const base: ReminderMatch = {
  id: "m1",
  title: "League",
  ourTeamName: "Team A",
  opponentName: "Dummy Team 001",
  opponentIsDummy: true,
  startsAt: istToInstant("2026-10-12", "07:00").toISOString(),
  confirmedCount: 5,
  status: "scheduled",
};
const now = new Date("2026-10-11T02:00:00Z"); // deterministic clock, inside the window

describe("processReminders", () => {
  it("creates one combined notification per administrator", async () => {
    const repo = new MemoryRepo([base], ["admin-1", "admin-2"]);
    const summary = await processReminders(repo, now);
    expect(summary.notificationsCreated).toBe(2);
    expect([...repo.ledger.values()].map((r) => r.type)).toEqual(["readiness_alert", "readiness_alert"]);
  });

  it("repeated scheduler runs do not create duplicates", async () => {
    const repo = new MemoryRepo([base], ["admin-1"]);
    await processReminders(repo, now);
    const second = await processReminders(repo, new Date(now.getTime() + 15 * 60_000));
    const third = await processReminders(repo, new Date(now.getTime() + 30 * 60_000));
    expect(repo.ledger.size).toBe(1);
    expect(second.notificationsCreated).toBe(0);
    expect(second.duplicatesSkipped).toBe(1);
    expect(third.notificationsCreated).toBe(0);
  });

  it("a rescheduled match is a new occurrence and is reminded again", async () => {
    const repo = new MemoryRepo([base], ["admin-1"]);
    await processReminders(repo, now);
    repo.matches = [{ ...base, startsAt: istToInstant("2026-10-12", "08:00").toISOString() }];
    const summary = await processReminders(repo, now);
    expect(summary.notificationsCreated).toBe(1);
  });

  it("continues processing other matches when one fails", async () => {
    const repo = new MemoryRepo([base, { ...base, id: "m2" }], ["admin-1"], ["m1"]);
    const summary = await processReminders(repo, now);
    expect(summary.errors).toEqual([{ matchId: "m1", message: "database unavailable" }]);
    expect(summary.notificationsCreated).toBe(1);
  });

  it("does nothing for a ready match with a real opponent", async () => {
    const repo = new MemoryRepo([{ ...base, opponentIsDummy: false, confirmedCount: 11 }], ["admin-1"]);
    expect((await processReminders(repo, now)).notificationsCreated).toBe(0);
  });
});
