/**
 * Zod schemas shared by client forms (usability) and server actions
 * (authoritative). Only the fields listed here are ever written to the
 * database, which prevents mass assignment.
 */
import { z } from "zod";
import { isIsoDate, isIsoTime } from "@/lib/ist";
import {
  ENROLLMENT_STATUSES,
  MATCH_STATUSES,
  PARTICIPATION_STATUSES,
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
} from "@/lib/labels";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalText = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, { error: `Must be at most ${max} characters` })
      .optional(),
  );

const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters` })
    .max(max, { error: `${label} must be at most ${max} characters` });

const uuid = (label: string) => z.uuid({ error: `Select a valid ${label}` });
const optionalUuid = (label: string) => z.preprocess(emptyToUndefined, uuid(label).optional());

export const istDate = (label: string) =>
  z.string({ error: `${label} is required` }).refine(isIsoDate, { error: `${label} must be a valid date (IST)` });

export const istTime = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .refine(isIsoTime, { error: `${label} must be a valid time (IST)` })
    .transform((v) => v.slice(0, 5));

const httpsUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https?$/, error: "Enter a valid web address starting with http:// or https://" })
    .max(500)
    .optional(),
);

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------
export const tournamentSchema = z
  .object({
    name: requiredText("Tournament name", 2, 120),
    organizer: optionalText(120),
    format: z.enum(TOURNAMENT_FORMATS, { error: "Select a format" }),
    startDate: istDate("Start date"),
    endDate: istDate("End date"),
    venueId: optionalUuid("venue"),
    location: optionalText(200),
    websiteUrl: httpsUrl,
    notes: optionalText(2000),
    status: z.enum(TOURNAMENT_STATUSES, { error: "Select a status" }),
  })
  .refine((t) => t.endDate >= t.startDate, { path: ["endDate"], error: "End date must be on or after the start date" });
export type TournamentInput = z.infer<typeof tournamentSchema>;

export const enrollmentSchema = z.object({
  tournamentId: uuid("tournament"),
  teamId: uuid("team"),
  status: z.enum(ENROLLMENT_STATUSES),
  notes: optionalText(500),
});

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
const cricheroesUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https$/, error: "Enter a valid https:// CricHeroes link" })
    .max(500)
    .refine((u) => /^https:\/\/([a-z0-9-]+\.)*cricheroes\.(in|com)(\/|$)/i.test(u), {
      error: "The link must point to cricheroes.in or cricheroes.com",
    })
    .optional(),
);

export const matchSchema = z
  .object({
    title: requiredText("Match title", 2, 120),
    category: z.enum(["tournament", "practice"], { error: "Select Tournament Match or Practice Match" }),
    tournamentId: optionalUuid("tournament"),
    matchDate: istDate("Match date"),
    startTime: istTime("Start time"),
    reportingTime: z.preprocess(emptyToUndefined, istTime("Reporting time").optional()),
    venueId: optionalUuid("venue"),
    ourTeamId: uuid("team"),
    opponentMode: z.enum(["existing", "dummy", "new"], { error: "Choose an opponent option" }),
    opponentId: optionalUuid("opponent"),
    newOpponentName: optionalText(80),
    notes: optionalText(2000),
    cricheroesUrl,
    // Administrator-only fields (ignored for teammates by the server action):
    status: z.preprocess(emptyToUndefined, z.enum(MATCH_STATUSES).optional()),
    resultSummary: optionalText(500),
    allowDuplicate: checkbox.optional(),
    includeMe: checkbox.optional(),
  })
  .superRefine((m, ctx) => {
    if (m.category === "tournament" && !m.tournamentId) {
      ctx.addIssue({
        code: "custom",
        path: ["tournamentId"],
        message: "Select an enrolled tournament for a Tournament Match",
      });
    }
    if (m.opponentMode === "existing" && !m.opponentId) {
      ctx.addIssue({ code: "custom", path: ["opponentId"], message: "Select an opponent or use a dummy opponent" });
    }
    if (m.opponentMode === "new" && (!m.newOpponentName || m.newOpponentName.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["newOpponentName"], message: "Enter the new opponent's name" });
    }
    if (m.reportingTime && m.reportingTime > m.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["reportingTime"],
        message: "Reporting time must be at or before the start time",
      });
    }
  })
  .transform((m) => ({
    ...m,
    // Practice matches never carry tournament information.
    tournamentId: m.category === "practice" ? undefined : m.tournamentId,
    opponentId: m.opponentMode === "existing" ? m.opponentId : undefined,
    newOpponentName: m.opponentMode === "new" ? m.newOpponentName : undefined,
  }));
export type MatchInput = z.infer<typeof matchSchema>;

export const cancelMatchSchema = z.object({
  matchId: uuid("match"),
  reason: optionalText(500),
});

export const replaceOpponentSchema = z.object({
  matchId: uuid("match"),
  opponentId: uuid("opponent"),
});

export const participationSchema = z.object({
  matchId: uuid("match"),
  profileId: uuid("player"),
  status: z.enum(PARTICIPATION_STATUSES, { error: "Select a valid response" }),
  note: optionalText(280),
});

export const addParticipantsSchema = z.object({
  matchId: uuid("match"),
  profileIds: z.array(uuid("player")).min(1, { error: "Select at least one player" }).max(200),
});

export const removeParticipantSchema = z.object({
  matchId: uuid("match"),
  profileId: uuid("player"),
});

// ---------------------------------------------------------------------------
// People, teams and reference data
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  displayName: requiredText("Display name", 1, 80),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, { error: "Enter a valid phone number, e.g. +91 98765 43210" })
      .optional(),
  ),
});

export const preferencesSchema = z.object({
  pushOperationalAlerts: checkbox,
  pushMatchUpdates: checkbox,
  pushPlayerConfirmations: checkbox,
  pushAnnouncements: checkbox,
});

export const teamSchema = z.object({
  name: requiredText("Team name", 2, 80),
  shortName: optionalText(12),
  description: optionalText(1000),
});

export const membershipSchema = z.object({
  teamId: uuid("team"),
  profileId: uuid("player"),
  squadRole: z.enum(["captain", "vice_captain", "wicket_keeper", "player"]),
});

export const venueSchema = z.object({
  name: requiredText("Venue name", 2, 120),
  address: optionalText(300),
  city: optionalText(80),
  mapsUrl: z.preprocess(
    emptyToUndefined,
    z
      .url({ protocol: /^https$/, error: "Enter a valid https:// maps link" })
      .max(500)
      .optional(),
  ),
  notes: optionalText(1000),
});

export const opponentSchema = z.object({
  name: requiredText("Opponent name", 2, 80),
  notes: optionalText(1000),
});

export const userAdminSchema = z.object({
  profileId: uuid("user"),
  role: z.enum(["admin", "teammate"]).optional(),
  status: z.enum(["pending", "active", "inactive"]).optional(),
});

export const inviteSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase().max(254),
  displayName: requiredText("Display name", 1, 80),
  teamId: optionalUuid("team"),
});

export const announcementSchema = z.object({
  title: requiredText("Title", 1, 140),
  body: requiredText("Message", 1, 1000),
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
export const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Password is required" }).max(128),
});

export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters" })
  .max(128, { error: "Password must be at most 128 characters" });

export const signUpSchema = z.object({
  displayName: requiredText("Display name", 1, 80),
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).trim().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(64),
  }),
  deviceLabel: optionalText(120),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export type FieldErrors = Record<string, string[] | undefined>;

export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      out[k] = [...((out[k] as string[] | undefined) ?? []), value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
