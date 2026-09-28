"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { enrollmentSchema, tournamentSchema, type TournamentInput } from "@/lib/validation/schemas";
import { dbFailure, parseForm, validationFailure, withSession } from "@/server/action-utils";

function toRow(t: TournamentInput) {
  return {
    name: t.name,
    organizer: t.organizer ?? null,
    format: t.format,
    start_date: t.startDate,
    end_date: t.endDate,
    venue_id: t.venueId ?? null,
    location: t.location ?? null,
    website_url: t.websiteUrl ?? null,
    notes: t.notes ?? null,
    status: t.status,
  };
}

export async function createTournamentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await withSession<string>(
    async ({ supabase, userId }) => {
      const parsed = parseForm(tournamentSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { data, error } = await supabase
        .from("tournaments")
        .insert({ ...toRow(parsed.data), created_by: userId })
        .select("id")
        .single();
      if (error) return dbFailure(error);

      const enrollTeamIds = formData
        .getAll("enrollTeamIds[]")
        .map(String)
        .filter((v) => z.uuid().safeParse(v).success);
      if (enrollTeamIds.length) {
        const { error: enrollError } = await supabase
          .from("tournament_enrollments")
          .insert(
            enrollTeamIds.map((teamId) => ({ tournament_id: data.id, team_id: teamId, status: "enrolled" as const })),
          );
        if (enrollError) return dbFailure(enrollError, "Tournament created, but enrolment failed.");
      }
      return { ok: true, data: data.id };
    },
    { admin: true },
  );
  if (!result.ok) return result;
  revalidatePath("/tournaments");
  redirect(`/tournaments/${result.data}?saved=1`);
}

export async function updateTournamentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Invalid tournament." };
  const result = await withSession(
    async ({ supabase }) => {
      const parsed = parseForm(tournamentSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { error, count } = await supabase
        .from("tournaments")
        .update(toRow(parsed.data), { count: "exact" })
        .eq("id", id.data);
      if (error) return dbFailure(error);
      if (!count) return { ok: false, error: "Tournament not found or you are not allowed to edit it." };
      return { ok: true };
    },
    { admin: true },
  );
  if (!result.ok) return result;
  revalidatePath("/tournaments");
  redirect(`/tournaments/${id.data}?saved=1`);
}

export async function setTournamentArchivedAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ id: z.uuid(), archived: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), archived: formData.get("archived") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(
    async ({ supabase }) => {
      const archived = input.data.archived === "true";
      const { error, count } = await supabase
        .from("tournaments")
        .update({ archived_at: archived ? new Date().toISOString() : null }, { count: "exact" })
        .eq("id", input.data.id);
      if (error) return dbFailure(error);
      if (!count) return { ok: false, error: "Tournament not found." };
      revalidatePath("/tournaments");
      revalidatePath(`/tournaments/${input.data.id}`);
      return { ok: true, message: archived ? "Tournament archived." : "Tournament restored." };
    },
    { admin: true },
  );
}

export async function deleteTournamentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Invalid tournament." };
  const result = await withSession(
    async ({ supabase }) => {
      const { count: matchCount } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", id.data);
      if (matchCount) {
        return {
          ok: false,
          error: "This tournament has matches, so it must be archived instead of deleted (retention rule).",
          code: "HAS_MATCHES",
        };
      }
      const { error, count } = await supabase.from("tournaments").delete({ count: "exact" }).eq("id", id.data);
      if (error) return dbFailure(error);
      if (!count) return { ok: false, error: "Tournament not found." };
      return { ok: true };
    },
    { admin: true },
  );
  if (!result.ok) return result;
  revalidatePath("/tournaments");
  redirect("/tournaments?deleted=1");
}

export async function upsertEnrollmentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(
    async ({ supabase }) => {
      const parsed = parseForm(enrollmentSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { error } = await supabase.from("tournament_enrollments").upsert(
        {
          tournament_id: parsed.data.tournamentId,
          team_id: parsed.data.teamId,
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
        },
        { onConflict: "tournament_id,team_id" },
      );
      if (error) return dbFailure(error);
      revalidatePath(`/tournaments/${parsed.data.tournamentId}`);
      return { ok: true, message: "Enrolment saved." };
    },
    { admin: true },
  );
}

export async function removeEnrollmentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ tournamentId: z.uuid(), teamId: z.uuid() })
    .safeParse({ tournamentId: formData.get("tournamentId"), teamId: formData.get("teamId") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(
    async ({ supabase }) => {
      const { error } = await supabase
        .from("tournament_enrollments")
        .delete()
        .eq("tournament_id", input.data.tournamentId)
        .eq("team_id", input.data.teamId);
      if (error) return dbFailure(error);
      revalidatePath(`/tournaments/${input.data.tournamentId}`);
      return { ok: true, message: "Enrolment removed." };
    },
    { admin: true },
  );
}
