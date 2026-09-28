import "server-only";
import type { ActionResult } from "@/lib/action-result";
import type { ActiveSession } from "@/lib/auth";
import { SELF_PARTICIPATION_STATUSES, type ParticipationStatus } from "@/lib/labels";
import { dbFailure, forbidden } from "@/server/action-utils";

/**
 * Sets a player's participation for a match.
 * - Teammates may change only their own row, and never to "playing".
 * - Administrators may change anyone's status.
 * The same rules are enforced again by RLS and triggers in Postgres.
 */
export async function setParticipation(
  session: ActiveSession,
  input: { matchId: string; profileId: string; status: ParticipationStatus; note?: string },
): Promise<ActionResult> {
  const { supabase, userId, isAdmin } = session;
  if (!isAdmin) {
    if (input.profileId !== userId) return forbidden;
    if (!SELF_PARTICIPATION_STATUSES.includes(input.status) && input.status !== "not_responded") return forbidden;
  }

  const { data: existing, error: readError } = await supabase
    .from("match_participants")
    .select("id")
    .eq("match_id", input.matchId)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (readError) return dbFailure(readError);

  const values = { status: input.status, ...(input.note !== undefined ? { note: input.note || null } : {}) };
  const { error } = existing
    ? await supabase.from("match_participants").update(values).eq("id", existing.id)
    : await supabase
        .from("match_participants")
        .insert({ match_id: input.matchId, profile_id: input.profileId, ...values });
  if (error) return dbFailure(error);
  return { ok: true, message: "Response saved." };
}
