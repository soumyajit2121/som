/**
 * India Standard Time helpers.
 *
 * Every business date and time in this app is IST (Asia/Kolkata, +05:30).
 * All conversions go through Luxon's IANA timezone support. Nothing here adds
 * or subtracts 5h30m by hand, and nothing depends on the timezone of the
 * server, the database session or the browser.
 */
import { DateTime, Duration } from "luxon";

export const IST_ZONE = "Asia/Kolkata";
export const IST_LABEL = "IST";
export const IST_OFFSET = "+05:30";
const FORMAT_LOCALE = "en-US"; // gives "Oct" and "AM" consistently

export const REMINDER_LEAD = Duration.fromObject({ hours: 25 });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && DateTime.fromISO(value, { zone: IST_ZONE }).isValid;
}

export function isIsoTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** "07:00:00" or "07:00" → "07:00" */
export function normalizeTime(value: string): string {
  if (!isIsoTime(value)) throw new Error(`Invalid time: ${value}`);
  return value.slice(0, 5);
}

/** Accepts ISO-8601 and Postgres text forms ("2026-10-12 01:30:00+00"). */
function parseInstantString(value: string): DateTime {
  const iso = DateTime.fromISO(value, { setZone: true });
  if (iso.isValid) return iso;
  const sql = DateTime.fromSQL(value, { setZone: true });
  if (sql.isValid) return sql;
  return DateTime.fromISO(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"), { setZone: true });
}

function toDateTime(instant: Date | string | number): DateTime {
  const dt =
    instant instanceof Date
      ? DateTime.fromJSDate(instant)
      : typeof instant === "number"
        ? DateTime.fromMillis(instant)
        : parseInstantString(instant);
  if (!dt.isValid) throw new Error(`Invalid instant: ${String(instant)}`);
  return dt.setZone(IST_ZONE).setLocale(FORMAT_LOCALE);
}

/** Converts an IST wall-clock date and time into an absolute instant. */
export function istToInstant(date: string, time: string): Date {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
  const dt = DateTime.fromISO(`${date}T${normalizeTime(time)}`, { zone: IST_ZONE });
  if (!dt.isValid) throw new Error(`Invalid IST date-time: ${date} ${time}`);
  return dt.toJSDate();
}

/** ISO-8601 string with an explicit +05:30 offset, e.g. 2026-10-12T07:00:00.000+05:30 */
export function toIstIso(instant: Date | string | number): string {
  return toDateTime(instant).toISO({ suppressMilliseconds: false })!;
}

/** Calendar date (YYYY-MM-DD) of an instant, as observed in IST. */
export function istDateOf(instant: Date | string | number): string {
  return toDateTime(instant).toISODate()!;
}

/** Wall-clock time (HH:mm) of an instant, as observed in IST. */
export function istTimeOf(instant: Date | string | number): string {
  return toDateTime(instant).toFormat("HH:mm");
}

/** Today's calendar date in IST. */
export function todayIst(now: Date = new Date()): string {
  return istDateOf(now);
}

/** "12 Oct 2026, 07:00 AM IST" */
export function formatIst(instant: Date | string | number): string {
  return `${toDateTime(instant).toFormat("dd LLL yyyy, hh:mm a")} ${IST_LABEL}`;
}

/** Formats a stored IST calendar date (no conversion): "12 Oct 2026" */
export function formatIstDate(date: string): string {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
  return DateTime.fromISO(date, { zone: IST_ZONE }).setLocale(FORMAT_LOCALE).toFormat("dd LLL yyyy");
}

/** "Mon, 12 Oct 2026" */
export function formatIstDateLong(date: string): string {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
  return DateTime.fromISO(date, { zone: IST_ZONE }).setLocale(FORMAT_LOCALE).toFormat("ccc, dd LLL yyyy");
}

/** Formats a stored IST wall-clock time: "07:00 AM IST" */
export function formatIstTime(time: string): string {
  const [h, m] = normalizeTime(time).split(":").map(Number);
  return `${DateTime.fromObject({ hour: h, minute: m }, { zone: IST_ZONE })
    .setLocale(FORMAT_LOCALE)
    .toFormat("hh:mm a")} ${IST_LABEL}`;
}

/** Formats a stored IST date + time: "12 Oct 2026, 07:00 AM IST" */
export function formatIstDateTime(date: string, time: string): string {
  return formatIst(istToInstant(date, time));
}

/** The moment the 25-hour pre-match reminder becomes due. */
export function reminderDueAt(startsAt: Date | string): Date {
  return toDateTime(startsAt).minus(REMINDER_LEAD).toJSDate();
}

/**
 * True when `now` is inside the reminder window: at or after the 25-hour mark
 * and before the match starts. A late scheduler run still falls inside it.
 */
export function isInReminderWindow(startsAt: Date | string, now: Date): boolean {
  const start = toDateTime(startsAt).toMillis();
  const due = reminderDueAt(startsAt).getTime();
  const t = now.getTime();
  return t >= due && t < start;
}

/** Adds whole calendar days to an IST date string. */
export function addIstDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: IST_ZONE }).plus({ days }).toISODate()!;
}

/** Month grid (Monday first) for an IST year/month, as IST date strings. */
export function istMonthGrid(year: number, month: number): string[][] {
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: IST_ZONE });
  const start = first.minus({ days: first.weekday - 1 });
  const weeks: string[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor.toISODate()!);
      cursor = cursor.plus({ days: 1 });
    }
    weeks.push(week);
    if (cursor.month !== month && w >= 3) break;
  }
  return weeks;
}

export function formatIstMonth(year: number, month: number): string {
  return DateTime.fromObject({ year, month, day: 1 }, { zone: IST_ZONE })
    .setLocale(FORMAT_LOCALE)
    .toFormat("LLLL yyyy");
}
