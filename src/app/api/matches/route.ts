import type { NextRequest } from "next/server";
import { getActiveSession } from "@/lib/auth";
import { MATCH_VIEWS, listMatches, myTeamIds, type MatchView } from "@/lib/data/matches";
import { serializeMatch } from "@/lib/data/serialize";
import { json, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const viewParam = request.nextUrl.searchParams.get("view") ?? "upcoming";
  const view = (MATCH_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as MatchView) : "upcoming";
  const teamIds = await myTeamIds(session.supabase, session.userId);
  const matches = await listMatches(session.supabase, { view, profileId: session.userId, teamIds, limit: 100 });
  return json({ timezone: "Asia/Kolkata", matches: matches.map(serializeMatch) });
}
