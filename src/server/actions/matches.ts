"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import type { ActiveSession } from "@/lib/auth";
import { istToInstant } from "@/lib/ist";
import type { Database } from "@/lib/supabase/database.types";
import {
  addParticipantsSchema,
  cancelMatchSchema,
  matchSchema,
  participationSchema,
  removeParticipantSchema,
  replaceOpponentSchema,
  type MatchInput,
} from "@/lib/validation/schemas";
import { dbFailure, forbidden, parseForm, validationFailure, withSession } from "@/server/action-utils";
import { dispatchPushSoon } from "@/server/dispatch-now";
import { setParticipation } from "@/server/services/participation";

type MatchUpdate = Database["public"]["Tables"]["matches"]["Update"];

async function resolveOpponent(
  session: ActiveSession,
  input: MatchInput,
): Promise<{ ok: true; id: string } | ActionFailure> {
  const { supabase, isAdmin, userId } = session;
  if (input.opponentMode === "dummy") {
    const { data, error } = await supabase.rpc("create_dummy_opponent");
    if (error || !data) return dbFailure(error ?? {}, "Could not create a dummy opponent.");
    return { ok: true, id: (data as { id: string }).id };
  }
  if (input.opponentMode === "new") {
    if (!isAdmin) return { ...forbidden, error: "Only administrators can create new opponents." } as ActionFailure;
    const { data, error } = await supabase
      .from("opponents")
      .insert({ name: input.newOpponentName!, created_by: userId })
      .select("id")
      .single();
    if (error) return dbFailure(error, "Could not create the opponent.");
    return { ok: true, id: data.id };
  }
  return { ok: true, id: input.opponentId! };
}

function revalidateMatches(id?: string) {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/calendar");
  if (id) revalidatePath(`/matches/${id}`);
}

export async function createMatchAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await withSession<string>(async (session) => {
    const { supabase, userId, isAdmin } = session;
    const parsed = parseForm(matchSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    if (!isAdmin) {
      const { data: membership } = await supabase
        .from("team_memberships")
        .select("id")
        .eq("team_id", input.ourTeamId)
        .eq("profile_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) {
        return { ok: false, error: "You can only create matches for a team you belong to.", code: "FORBIDDEN" };
      }
    }

    const opponent = await resolveOpponent(session, input);
    if (!opponent.ok) return opponent;

    const { data, error } = await supabase
      .from("matches")
      .insert({
        title: input.title,
        category: input.category,
        tournament_id: input.category === "tournament" ? input.tournamentId! : null,
        match_date: input.matchDate,
        start_time: input.startTime,
        reporting_time: input.reportingTime ?? null,
        timezone: "Asia/Kolkata",
        venue_id: input.venueId ?? null,
        our_team_id: input.ourTeamId,
        opponent_id: opponent.id,
        notes: input.notes ?? null,
        cricheroes_url: input.cricheroesUrl ?? null,
        created_by: userId,
        // Administrator-only fields are dropped for teammates (no mass assignment).
        status: isAdmin && input.status && input.status !== "cancelled" ? input.status : "scheduled",
        allow_duplicate: isAdmin ? Boolean(input.allowDuplicate) : false,
        starts_at: istToInstant(input.matchDate, input.startTime).toISOString(), // re-derived by the database
      })
      .select("id")
      .single();
    if (error) return dbFailure(error);

    if (isAdmin && input.includeMe) {
      await supabase.from("match_participants").insert({ match_id: data.id, profile_id: userId, status: "confirmed" });
    }
    return { ok: true, data: data.id };
  });
  if (!result.ok) return result;
  revalidateMatches();
  redirect(`/matches/${result.data}?created=1`);
}

export async function updateMatchAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Invalid match." };

  const result = await withSession(async (session) => {
    const { supabase, userId, isAdmin } = session;
    const { data: current, error: readError } = await supabase
      .from("matches")
      .select("id, created_by, status, opponent_id")
      .eq("id", id.data)
      .maybeSingle();
    if (readError) return dbFailure(readError);
    if (!current) return { ok: false, error: "Match not found." };
    if (!isAdmin && current.created_by !== userId) return forbidden;

    const parsed = parseForm(matchSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;

    // Basic details that a teammate may edit on a match they created.
    const update: MatchUpdate = {
      title: input.title,
      match_date: input.matchDate,
      start_time: input.startTime,
      reporting_time: input.reportingTime ?? null,
      venue_id: input.venueId ?? null,
      notes: input.notes ?? null,
      cricheroes_url: input.cricheroesUrl ?? null,
    };

    if (isAdmin) {
      let opponentId = current.opponent_id;
      if (input.opponentMode !== "existing" || input.opponentId !== current.opponent_id) {
        const opponent = await resolveOpponent(session, input);
        if (!opponent.ok) return opponent;
        opponentId = opponent.id;
      }
      Object.assign(update, {
        category: input.category,
        tournament_id: input.category === "tournament" ? input.tournamentId! : null,
        our_team_id: input.ourTeamId,
        opponent_id: opponentId,
        result_summary: input.resultSummary ?? null,
        allow_duplicate: Boolean(input.allowDuplicate),
        ...(input.status && input.status !== "cancelled" ? { status: input.status } : {}),
      } satisfies MatchUpdate);
    }

    const { error, count } = await supabase.from("matches").update(update, { count: "exact" }).eq("id", id.data);
    if (error) return dbFailure(error);
    if (!count) return forbidden;
    return { ok: true };
  });
  if (!result.ok) return result;
  dispatchPushSoon();
  revalidateMatches(id.data);
  redirect(`/matches/${id.data}?saved=1`);
}

export async function cancelMatchAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(
    async ({ supabase }) => {
      const parsed = parseForm(cancelMatchSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { error, count } = await supabase
        .from("matches")
        .update({ status: "cancelled", cancellation_reason: parsed.data.reason ?? null }, { count: "exact" })
        .eq("id", parsed.data.matchId);
      if (error) return dbFailure(error);
      if (!count) return { ok: false, error: "Match not found." };
      dispatchPushSoon();
      revalidateMatches(parsed.data.matchId);
      return { ok: true, message: "Match cancelled. Participants have been notified." };
    },
    { admin: true },
  );
}

export async function restoreMatchAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("matchId"));
  if (!id.success) return { ok: false, error: "Invalid match." };
  return withSession(
    async ({ supabase }) => {
      const { error } = await supabase
        .from("matches")
        .update({ status: "scheduled", cancellation_reason: null })
        .eq("id", id.data);
      if (error) return dbFailure(error);
      revalidateMatches(id.data);
      return { ok: true, message: "Match restored to Scheduled." };
    },
    { admin: true },
  );
}

export async function deleteMatchAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("matchId"));
  if (!id.success) return { ok: false, error: "Invalid match." };
  const result = await withSession(async ({ supabase, userId, isAdmin }) => {
    if (!isAdmin) {
      const { count } = await supabase
        .from("match_participants")
        .select("id", { count: "exact", head: true })
        .eq("match_id", id.data)
        .neq("profile_id", userId);
      if (count) {
        return {
          ok: false,
          error:
            "Other players have joined this match, so it can no longer be deleted. Ask an administrator to cancel it.",
          code: "HAS_PARTICIPANTS",
        };
      }
    }
    const { error, count } = await supabase.from("matches").delete({ count: "exact" }).eq("id", id.data);
    if (error) return dbFailure(error);
    if (!count) return forbidden;
    return { ok: true };
  });
  if (!result.ok) return result;
  revalidateMatches();
  redirect("/matches?deleted=1");
}

export async function replaceOpponentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(
    async ({ supabase }) => {
      const parsed = parseForm(replaceOpponentSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { error, count } = await supabase
        .from("matches")
        .update({ opponent_id: parsed.data.opponentId }, { count: "exact" })
        .eq("id", parsed.data.matchId);
      if (error) return dbFailure(error);
      if (!count) return { ok: false, error: "Match not found." };
      dispatchPushSoon();
      revalidateMatches(parsed.data.matchId);
      return { ok: true, message: "Opponent replaced. Remember to update the match in CricHeroes." };
    },
    { admin: true },
  );
}

export async function takeOwnershipAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("matchId"));
  if (!id.success) return { ok: false, error: "Invalid match." };
  return withSession(
    async ({ supabase, userId }) => {
      const { error } = await supabase.from("matches").update({ created_by: userId }).eq("id", id.data);
      if (error) return dbFailure(error);
      revalidateMatches(id.data);
      return { ok: true, message: "You now own this match." };
    },
    { admin: true },
  );
}

export async function setParticipationAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async (session) => {
    const parsed = parseForm(participationSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const result = await setParticipation(session, parsed.data);
    if (result.ok) {
      dispatchPushSoon();
      revalidateMatches(parsed.data.matchId);
    }
    return result;
  });
}

export async function addParticipantsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(
    async ({ supabase }) => {
      const parsed = addParticipantsSchema.safeParse({
        matchId: formData.get("matchId"),
        profileIds: formData.getAll("profileIds[]"),
      });
      if (!parsed.success) return validationFailure(parsed.error);
      const { error } = await supabase.from("match_participants").upsert(
        parsed.data.profileIds.map((profileId) => ({
          match_id: parsed.data.matchId,
          profile_id: profileId,
          status: "not_responded" as const,
        })),
        { onConflict: "match_id,profile_id", ignoreDuplicates: true },
      );
      if (error) return dbFailure(error);
      revalidateMatches(parsed.data.matchId);
      return { ok: true, message: `${parsed.data.profileIds.length} player(s) added.` };
    },
    { admin: true },
  );
}

export async function inviteSquadAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("matchId"));
  if (!id.success) return { ok: false, error: "Invalid match." };
  return withSession(
    async ({ supabase }) => {
      const { data: match } = await supabase.from("matches").select("our_team_id").eq("id", id.data).maybeSingle();
      if (!match) return { ok: false, error: "Match not found." };
      const { data: squad, error: squadError } = await supabase
        .from("team_memberships")
        .select("profile_id, profiles!inner(status)")
        .eq("team_id", match.our_team_id)
        .eq("is_active", true)
        .eq("profiles.status", "active");
      if (squadError) return dbFailure(squadError);
      if (!squad?.length) return { ok: false, error: "This team has no active players yet." };
      const { error } = await supabase.from("match_participants").upsert(
        squad.map((s) => ({ match_id: id.data, profile_id: s.profile_id, status: "not_responded" as const })),
        { onConflict: "match_id,profile_id", ignoreDuplicates: true },
      );
      if (error) return dbFailure(error);
      revalidateMatches(id.data);
      return { ok: true, message: "The whole squad has been invited." };
    },
    { admin: true },
  );
}

export async function removeParticipantAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, isAdmin, userId }) => {
    const parsed = parseForm(removeParticipantSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    if (!isAdmin && parsed.data.profileId !== userId) return forbidden;
    const { error, count } = await supabase
      .from("match_participants")
      .delete({ count: "exact" })
      .eq("match_id", parsed.data.matchId)
      .eq("profile_id", parsed.data.profileId);
    if (error) return dbFailure(error);
    if (!count) return forbidden;
    revalidateMatches(parsed.data.matchId);
    return { ok: true, message: "Player removed from the match." };
  });
}
