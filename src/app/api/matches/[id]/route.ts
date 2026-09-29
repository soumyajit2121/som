import type { NextRequest } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/auth";
import { getMatch, listParticipants } from "@/lib/data/matches";
import { serializeMatch, serializeParticipant } from "@/lib/data/serialize";
import { json, jsonError } from "@/lib/http";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/matches/[id]">) {
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Not found");
  const match = await getMatch(session.supabase, id);
  if (!match) return jsonError(404, "Not found");
  const participants = await listParticipants(session.supabase, id);
  return json({ match: serializeMatch(match), participants: participants.map(serializeParticipant) });
}
