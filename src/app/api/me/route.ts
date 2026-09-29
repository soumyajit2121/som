import { getSession } from "@/lib/auth";
import { json, jsonError } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Authentication required");
  return json({ id: session.userId, profile: session.profile });
}
