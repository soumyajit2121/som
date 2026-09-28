import { afterEach, describe, expect, it } from "vitest";
import {
  addIstDays,
  formatIst,
  formatIstDate,
  formatIstDateTime,
  formatIstTime,
  isInReminderWindow,
  istDateOf,
  istMonthGrid,
  istTimeOf,
  istToInstant,
  reminderDueAt,
  toIstIso,
  todayIst,
} from "@/lib/ist";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

/** Runs the same assertions with the process in several host timezones. */
const HOST_ZONES = ["UTC", "America/Los_Angeles", "Europe/London", "Asia/Tokyo", "Pacific/Kiritimati"];

describe("IST match creation", () => {
  it("converts an IST wall-clock time to the correct instant (07:00 IST = 01:30 UTC)", () => {
    expect(istToInstant("2026-10-12", "07:00").toISOString()).toBe("2026-10-12T01:30:00.000Z");
  });

  it.each(HOST_ZONES)("gives the same instant when the server runs in %s", (zone) => {
    process.env.TZ = zone;
    expect(istToInstant("2026-10-12", "07:00").toISOString()).toBe("2026-10-12T01:30:00.000Z");
    expect(new Date().getTimezoneOffset()).toBeTypeOf("number");
  });

  it("rejects invalid dates and times", () => {
    expect(() => istToInstant("2026-02-30", "07:00")).toThrow();
    expect(() => istToInstant("2026-10-12", "25:00")).toThrow();
  });
});

describe("IST display", () => {
  it("uses the DD MMM YYYY, hh:mm a IST format", () => {
    expect(formatIst("2026-10-12T01:30:00Z")).toBe("12 Oct 2026, 07:00 AM IST");
    expect(formatIstDateTime("2026-10-12", "07:00")).toBe("12 Oct 2026, 07:00 AM IST");
  });

  it.each(HOST_ZONES)("displays identically when the browser/host is in %s", (zone) => {
    process.env.TZ = zone;
    expect(formatIst(new Date("2026-10-12T01:30:00Z"))).toBe("12 Oct 2026, 07:00 AM IST");
    expect(formatIstDate("2026-10-12")).toBe("12 Oct 2026");
  });

  it("formats reporting time in IST", () => {
    expect(formatIstTime("06:30")).toBe("06:30 AM IST");
    expect(formatIstTime("18:05:00")).toBe("06:05 PM IST");
  });
});

describe("IST API serialization", () => {
  it("serializes instants with an explicit +05:30 offset", () => {
    expect(toIstIso("2026-10-12T01:30:00Z")).toBe("2026-10-12T07:00:00.000+05:30");
  });

  it("round-trips a Postgres timestamptz string without changing the instant", () => {
    const iso = toIstIso("2026-10-12 01:30:00+00");
    expect(new Date(iso).toISOString()).toBe("2026-10-12T01:30:00.000Z");
  });
});

describe("IST dates around midnight", () => {
  it("keeps 00:15 IST on the entered date even though it is the previous day in UTC", () => {
    const instant = istToInstant("2026-10-12", "00:15");
    expect(instant.toISOString()).toBe("2026-10-11T18:45:00.000Z");
    expect(istDateOf(instant)).toBe("2026-10-12");
    expect(istTimeOf(instant)).toBe("00:15");
    expect(formatIst(instant)).toBe("12 Oct 2026, 12:15 AM IST");
  });

  it("keeps 23:45 IST on the entered date", () => {
    const instant = istToInstant("2026-10-12", "23:45");
    expect(instant.toISOString()).toBe("2026-10-12T18:15:00.000Z");
    expect(istDateOf(instant)).toBe("2026-10-12");
  });

  it.each(HOST_ZONES)("computes 'today in IST' independently of the host zone (%s)", (zone) => {
    process.env.TZ = zone;
    // 19:00 UTC on 11 Oct is 00:30 IST on 12 Oct.
    expect(todayIst(new Date("2026-10-11T19:00:00Z"))).toBe("2026-10-12");
    // 18:29 UTC on 11 Oct is still 23:59 IST on 11 Oct.
    expect(todayIst(new Date("2026-10-11T18:29:00Z"))).toBe("2026-10-11");
  });

  it("formats stored tournament dates without any shift", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(formatIstDate("2026-01-01")).toBe("01 Jan 2026");
    expect(addIstDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("25-hour reminder calculation", () => {
  const startsAt = istToInstant("2026-10-12", "07:00"); // 01:30Z

  it("is due exactly 25 hours before the start (06:00 IST the previous day)", () => {
    expect(reminderDueAt(startsAt).toISOString()).toBe("2026-10-11T00:30:00.000Z");
    expect(formatIst(reminderDueAt(startsAt))).toBe("11 Oct 2026, 06:00 AM IST");
  });

  it("treats the window as [start - 25h, start)", () => {
    expect(isInReminderWindow(startsAt, new Date("2026-10-11T00:29:59Z"))).toBe(false);
    expect(isInReminderWindow(startsAt, new Date("2026-10-11T00:30:00Z"))).toBe(true);
    expect(isInReminderWindow(startsAt, new Date("2026-10-12T01:29:59Z"))).toBe(true); // late scheduler run
    expect(isInReminderWindow(startsAt, new Date("2026-10-12T01:30:00Z"))).toBe(false);
  });

  it.each(HOST_ZONES)("is unaffected by the host timezone (%s)", (zone) => {
    process.env.TZ = zone;
    expect(reminderDueAt(istToInstant("2026-10-12", "07:00")).toISOString()).toBe("2026-10-11T00:30:00.000Z");
  });
});

describe("calendar grid", () => {
  it("builds Monday-first weeks for an IST month", () => {
    const weeks = istMonthGrid(2026, 10);
    expect(weeks[0][0]).toBe("2026-09-28"); // Monday
    expect(weeks.flat()).toContain("2026-10-31");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
