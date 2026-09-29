import { getActiveSession } from "@/lib/auth";
import { json, jsonError } from "@/lib/http";

/** Non-sensitive player directory. Phone numbers and emails are never included. */
export async function GET() {
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const { data, error } = await session.supabase
    .from("profiles")
    .select("id, display_name, role, team_memberships(is_active, squad_role, teams(id, name))")
    .eq("status", "active")
    .order("display_name");
  if (error) return jsonError(500, "Could not load players");
  return json({
    players: (data ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: p.role,
      teams: p.team_memberships
        .filter((m) => m.is_active && m.teams)
        .map((m) => ({ id: m.teams!.id, name: m.teams!.name, squadRole: m.squad_role })),
    })),
  });
}
