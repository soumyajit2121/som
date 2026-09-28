import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export async function unreadCount(supabase: ServerSupabase, profileId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profileId)
    .is("read_at", null);
  return count ?? 0;
}
