import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export interface Option {
  id: string;
  name: string;
}

export interface TournamentOption extends Option {
  startDate: string;
  endDate: string;
  status: string;
  enrolledTeamIds: string[];
}

export interface MatchFormOptions {
  teams: Option[];
  venues: Option[];
  opponents: (Option & { isDummy: boolean })[];
  tournaments: TournamentOption[];
}

/**
 * Options for the create/edit match form. The tournament dropdown lists only
 * active or upcoming, non-archived tournaments in which a team is enrolled.
 */
export async function getMatchFormOptions(
  supabase: ServerSupabase,
  opts: { teamIds?: string[]; includeTournamentId?: string | null } = {},
): Promise<MatchFormOptions> {
  const [teams, venues, opponents, tournaments] = await Promise.all([
    supabase.from("teams").select("id, name").eq("is_active", true).order("name"),
    supabase.from("venues").select("id, name").eq("is_active", true).order("name"),
    supabase.from("opponents").select("id, name, is_dummy").eq("is_active", true).order("is_dummy").order("name"),
    supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status, archived_at, tournament_enrollments(team_id, status)")
      .is("archived_at", null)
      .order("start_date"),
  ]);

  const teamList = (teams.data ?? []).filter((t) => !opts.teamIds || opts.teamIds.includes(t.id));
  return {
    teams: teamList,
    venues: venues.data ?? [],
    opponents: (opponents.data ?? []).map((o) => ({ id: o.id, name: o.name, isDummy: o.is_dummy })),
    tournaments: (tournaments.data ?? [])
      .filter((t) => t.status !== "completed" || t.id === opts.includeTournamentId)
      .map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.start_date,
        endDate: t.end_date,
        status: t.status,
        enrolledTeamIds: (t.tournament_enrollments ?? []).filter((e) => e.status === "enrolled").map((e) => e.team_id),
      }))
      .filter((t) => t.enrolledTeamIds.length > 0),
  };
}
