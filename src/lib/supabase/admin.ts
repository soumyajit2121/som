import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "./database.types";

/**
 * Service-role client. It bypasses row-level security, so use it only in
 * trusted server code: the reminder scheduler and admin-verified actions.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
