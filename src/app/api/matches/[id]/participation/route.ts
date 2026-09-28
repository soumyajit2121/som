import type { NextRequest } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/auth";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import { PARTICIPATION_STATUSES } from "@/lib/labels";
import { setParticipation } from "@/server/services/participation";

const bodySchema = z.object({
  profileId: z.uuid().optional(),
  status: z.enum(PARTICIPATION_STATUSES),
  note: z.string().trim().max(280).optional(),
});

/**
 * Sets a participation status. Teammates may only target themselves; the
 * same rule is enforced again by Postgres RLS and triggers.
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/matches/[id]/participation">) {
  if (!isSameOrigin(request)) return jsonError(403, "Cross-site request rejected");
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Not found");
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request body");

  const result = await setParticipation(session, {
    matchId: id,
    profileId: body.data.profileId ?? session.userId,
    status: body.data.status,
    note: body.data.note,
  });
  if (!result.ok) return jsonError(result.code === "FORBIDDEN" ? 403 : 400, result.error, result.code);
  return json({ ok: true });
}
