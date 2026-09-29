import { describe, expect, it } from "vitest";
import { matchSchema, participationSchema, profileSchema, tournamentSchema } from "@/lib/validation/schemas";
import { safeRelativePath } from "@/lib/utils";
import { friendlyDbError } from "@/lib/errors";

const T = "22222222-2222-4222-8222-222222222222";
const baseMatch = {
  title: "League Match 5",
  matchDate: "2026-10-12",
  startTime: "07:00",
  reportingTime: "06:30",
  ourTeamId: T,
  opponentMode: "existing",
  opponentId: T,
};

describe("match validation", () => {
  it("requires a tournament for a Tournament Match", () => {
    const r = matchSchema.safeParse({ ...baseMatch, category: "tournament" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "tournamentId")).toBe(true);
  });

  it("clears the tournament for a Practice Match", () => {
    const r = matchSchema.parse({ ...baseMatch, category: "practice", tournamentId: T });
    expect(r.tournamentId).toBeUndefined();
  });

  it("accepts a tournament match with an enrolled tournament selected", () => {
    expect(matchSchema.parse({ ...baseMatch, category: "tournament", tournamentId: T }).tournamentId).toBe(T);
  });

  it("requires a match category", () => {
    expect(matchSchema.safeParse({ ...baseMatch }).success).toBe(false);
  });

  it("requires an opponent unless a dummy opponent is chosen", () => {
    expect(matchSchema.safeParse({ ...baseMatch, category: "practice", opponentId: "" }).success).toBe(false);
    const dummy = matchSchema.parse({ ...baseMatch, category: "practice", opponentMode: "dummy", opponentId: T });
    expect(dummy.opponentId).toBeUndefined();
  });

  it("rejects a reporting time after the start time", () => {
    expect(matchSchema.safeParse({ ...baseMatch, category: "practice", reportingTime: "08:00" }).success).toBe(false);
  });

  it("accepts only CricHeroes links for the CricHeroes URL", () => {
    const ok = matchSchema.safeParse({
      ...baseMatch,
      category: "practice",
      cricheroesUrl: "https://cricheroes.com/scorecard/1",
    });
    const bad = matchSchema.safeParse({
      ...baseMatch,
      category: "practice",
      cricheroesUrl: "https://evil.example/cricheroes.com",
    });
    const js = matchSchema.safeParse({ ...baseMatch, category: "practice", cricheroesUrl: "javascript:alert(1)" });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
    expect(js.success).toBe(false);
  });

  it("strips unknown fields (mass-assignment protection)", () => {
    const r = matchSchema.parse({ ...baseMatch, category: "practice", created_by: T, starts_at: "x" });
    expect(r).not.toHaveProperty("created_by");
    expect(r).not.toHaveProperty("starts_at");
  });
});

describe("other schemas", () => {
  it("requires tournament end date on or after start date", () => {
    const r = tournamentSchema.safeParse({
      name: "Cup",
      format: "T20",
      startDate: "2026-10-12",
      endDate: "2026-10-11",
      status: "upcoming",
    });
    expect(r.success).toBe(false);
  });

  it("validates participation statuses", () => {
    expect(participationSchema.safeParse({ matchId: T, profileId: T, status: "captain" }).success).toBe(false);
    expect(participationSchema.safeParse({ matchId: T, profileId: T, status: "available" }).success).toBe(true);
  });

  it("validates Indian phone numbers", () => {
    expect(profileSchema.safeParse({ displayName: "A", phone: "+91 98765 43210" }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: "A", phone: "<script>" }).success).toBe(false);
  });
});

describe("safety helpers", () => {
  it("allows only same-origin relative redirects", () => {
    expect(safeRelativePath("/matches/1")).toBe("/matches/1");
    expect(safeRelativePath("https://evil.example")).toBe("/");
    expect(safeRelativePath("//evil.example")).toBe("/");
    expect(safeRelativePath("/\\evil.example")).toBe("/");
  });

  it("maps database errors to safe messages", () => {
    expect(friendlyDbError({ message: "DUPLICATE_MATCH" })).toMatch(/already exists/);
    expect(friendlyDbError({ code: "42501", message: "new row violates row-level security policy" })).toMatch(
      /not allowed/,
    );
    expect(friendlyDbError({ code: "XX000", message: "internal detail" })).not.toContain("internal detail");
  });
});
