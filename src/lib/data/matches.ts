import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { todayIst, toIstIso } from "@/lib/ist";
import type { MatchCategory, MatchStatus, ParticipationStatus } from "@/lib/labels";

type OverviewRow = Database["public"]["Views"]["match_overview"]["Row"];

export interface MatchSummary {
  id: string;
  title: string;
  category: MatchCategory;
  tournamentId: string | null;
  tournamentName: string | null;
  matchDate: string;
  startTime: string;
  reportingTime: string | null;
  timezone: string;
  startsAt: string; // ISO with +05:30 offset
  reportingAt: string | null;
  venueId: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueMapsUrl: string | null;
  ourTeamId: string;
  ourTeamName: string;
  opponentId: string;
  opponentName: string;
  opponentIsDummy: boolean;
  createdBy: string | null;
  createdByName: string | null;
  notes: string | null;
  cricheroesUrl: string | null;
  status: MatchStatus;
  resultSummary: string | null;
  allowDuplicate: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  counts: {
    squad: number;
    invited: number;
    notResponded: number;
    available: number;
    maybe: number;
    unavailable: number;
    confirmed: number;
    playing: number;
    needed: number;
  };
}

export function toMatchSummary(r: OverviewRow): MatchSummary {
  return {
    id: r.id!,
    title: r.title!,
    category: r.category!,
    tournamentId: r.tournament_id,
    tournamentName: r.tournament_name,
    matchDate: r.match_date!,
    startTime: r.start_time!.slice(0, 5),
    reportingTime: r.reporting_time ? r.reporting_time.slice(0, 5) : null,
    timezone: r.timezone ?? "Asia/Kolkata",
    startsAt: toIstIso(r.starts_at!),
    reportingAt: r.reporting_at ? toIstIso(r.reporting_at) : null,
    venueId: r.venue_id,
    venueName: r.venue_name,
    venueCity: r.venue_city,
    venueMapsUrl: r.venue_maps_url,
    ourTeamId: r.our_team_id!,
    ourTeamName: r.our_team_name!,
    opponentId: r.opponent_id!,
    opponentName: r.opponent_name!,
    opponentIsDummy: Boolean(r.opponent_is_dummy),
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    notes: r.notes,
    cricheroesUrl: r.cricheroes_url,
    status: r.status!,
    resultSummary: r.result_summary,
    allowDuplicate: Boolean(r.allow_duplicate),
    cancelledAt: r.cancelled_at ? toIstIso(r.cancelled_at) : null,
    cancellationReason: r.cancellation_reason,
    counts: {
      squad: r.squad_count ?? 0,
      invited: r.invited_count ?? 0,
      notResponded: r.not_responded_count ?? 0,
      available: r.available_count ?? 0,
      maybe: r.maybe_count ?? 0,
      unavailable: r.unavailable_count ?? 0,
      confirmed: r.confirmed_count ?? 0,
      playing: r.playing_count ?? 0,
      needed: r.players_needed ?? 11,
    },
  };
}

export const MATCH_VIEWS = ["upcoming", "past", "tournament", "practice", "mine", "team", "all"] as const;
export type MatchView = (typeof MATCH_VIEWS)[number];

export interface ListMatchesOptions {
  view?: MatchView;
  search?: string;
  sort?: "date_asc" | "date_desc" | "title";
  status?: MatchStatus;
  profileId?: string;
  teamIds?: string[];
  tournamentId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  now?: Date;
}

/** Strips characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N} _.'-]/gu, " ")
    .trim()
    .slice(0, 60);
}

export async function listMatches(supabase: ServerSupabase, opts: ListMatchesOptions = {}): Promise<MatchSummary[]> {
  const today = todayIst(opts.now);
  let q = supabase.from("match_overview").select("*");
  const view = opts.view ?? "upcoming";

  if (view === "upcoming") q = q.gte("match_date", today).not("status", "in", "(completed,cancelled)");
  if (view === "past") q = q.or(`match_date.lt.${today},status.eq.completed`);
  if (view === "tournament") q = q.eq("category", "tournament");
  if (view === "practice") q = q.eq("category", "practice");
  if (view === "team")
    q = q.in("our_team_id", opts.teamIds?.length ? opts.teamIds : ["00000000-0000-0000-0000-000000000000"]);
  if (view === "mine" && opts.profileId) {
    const { data: mine } = await supabase
      .from("match_participants")
      .select("match_id")
      .eq("profile_id", opts.profileId);
    const ids = (mine ?? []).map((m) => m.match_id);
    q = q.or(`created_by.eq.${opts.profileId}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`);
  }
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.tournamentId) q = q.eq("tournament_id", opts.tournamentId);
  if (opts.fromDate) q = q.gte("match_date", opts.fromDate);
  if (opts.toDate) q = q.lte("match_date", opts.toDate);
  if (opts.search) {
    const s = sanitizeSearch(opts.search);
    if (s) {
      q = q.or(
        `title.ilike.*${s}*,opponent_name.ilike.*${s}*,tournament_name.ilike.*${s}*,venue_name.ilike.*${s}*,our_team_name.ilike.*${s}*`,
      );
    }
  }
  const sort = opts.sort ?? (view === "past" ? "date_desc" : "date_asc");
  if (sort === "title") q = q.order("title");
  else q = q.order("starts_at", { ascending: sort === "date_asc" });
  q = q.limit(opts.limit ?? 200);

  const { data, error } = await q;
  if (error) throw new Error(`Could not load matches: ${error.message}`);
  return (data ?? []).map(toMatchSummary);
}

export async function getMatch(supabase: ServerSupabase, id: string): Promise<MatchSummary | null> {
  const { data, error } = await supabase.from("match_overview").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load match: ${error.message}`);
  return data ? toMatchSummary(data) : null;
}

export interface ParticipantRow {
  id: string;
  profileId: string;
  displayName: string;
  status: ParticipationStatus;
  note: string | null;
  respondedAt: string | null;
}

export async function listParticipants(supabase: ServerSupabase, matchId: string): Promise<ParticipantRow[]> {
  const { data, error } = await supabase
    .from("match_participants")
    .select("id, profile_id, status, note, responded_at, profiles!match_participants_profile_id_fkey(display_name)")
    .eq("match_id", matchId);
  if (error) throw new Error(`Could not load participants: ${error.message}`);
  const order: ParticipationStatus[] = ["playing", "confirmed", "available", "maybe", "not_responded", "unavailable"];
  return (data ?? [])
    .map((p) => ({
      id: p.id,
      profileId: p.profile_id,
      displayName: p.profiles?.display_name ?? "Former member",
      status: p.status,
      note: p.note,
      respondedAt: p.responded_at ? toIstIso(p.responded_at) : null,
    }))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.displayName.localeCompare(b.displayName));
}

/** The signed-in user's participation for a set of matches. */
export async function myParticipation(
  supabase: ServerSupabase,
  profileId: string,
  matchIds: string[],
): Promise<Map<string, ParticipationStatus>> {
  const map = new Map<string, ParticipationStatus>();
  if (!matchIds.length) return map;
  const { data } = await supabase
    .from("match_participants")
    .select("match_id, status")
    .eq("profile_id", profileId)
    .in("match_id", matchIds);
  for (const row of data ?? []) map.set(row.match_id, row.status);
  return map;
}

export async function myTeamIds(supabase: ServerSupabase, profileId: string): Promise<string[]> {
  const { data } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", profileId)
    .eq("is_active", true);
  return (data ?? []).map((m) => m.team_id);
}
