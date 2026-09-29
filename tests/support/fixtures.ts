/**
 * Integration-test fixtures. Talks to the local Supabase stack exactly like
 * the browser would: users sign in with the public anon key and every request
 * goes through PostgREST and row-level security. Only fixture setup uses the
 * service-role key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error("Integration tests need a running local Supabase stack and .env.local (see README).");
  }
  return { url, anon, service };
}

export function serviceClient(): Db {
  const { url, service } = env();
  return createClient<Database>(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): Db {
  const { url, anon } = env();
  return createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  db: Db;
}

const PASSWORD = "Integration-Test-Pass-1";
let counter = 0;
export const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export async function createUser(
  opts: { role?: "admin" | "teammate"; status?: "pending" | "active" | "inactive"; name?: string } = {},
): Promise<TestUser> {
  const service = serviceClient();
  const n = ++counter;
  const email = `it-${runId}-${n}@example.com`;
  const name = opts.name ?? `Test Player ${runId}-${n}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const id = data.user.id;
  const status = opts.status ?? "active";
  if (status !== "pending") {
    const { error: e } = await service.from("profiles").update({ status }).eq("id", id);
    if (e) throw e;
  }
  if (opts.role === "admin") {
    const { error: e } = await service.from("profiles").update({ role: "admin" }).eq("id", id);
    if (e) throw e;
  }
  const db = anonClient();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id, email, name, db };
}

export interface World {
  admin: TestUser;
  admin2: TestUser;
  mate1: TestUser;
  mate2: TestUser;
  outsider: TestUser;
  pending: TestUser;
  teamId: string;
  otherTeamId: string;
  tournamentId: string;
  opponentId: string;
  venueId: string;
  cleanup: () => Promise<void>;
}

export async function createWorld(): Promise<World> {
  const service = serviceClient();
  const [admin, admin2, mate1, mate2, outsider, pending] = await Promise.all([
    createUser({ role: "admin" }),
    createUser({ role: "admin" }),
    createUser(),
    createUser(),
    createUser(),
    createUser({ status: "pending" }),
  ]);
  const team = await service
    .from("teams")
    .insert({ name: `IT Team ${runId}-${++counter}` })
    .select("id")
    .single();
  const other = await service
    .from("teams")
    .insert({ name: `IT Other ${runId}-${++counter}` })
    .select("id")
    .single();
  if (team.error || other.error) throw team.error ?? other.error;
  await service.from("team_memberships").insert([
    { team_id: team.data.id, profile_id: mate1.id },
    { team_id: team.data.id, profile_id: mate2.id },
    { team_id: team.data.id, profile_id: admin.id },
    { team_id: other.data.id, profile_id: outsider.id },
  ]);
  const venue = await service
    .from("venues")
    .insert({ name: `IT Ground ${runId}-${++counter}` })
    .select("id")
    .single();
  const opponent = await service
    .from("opponents")
    .insert({ name: `IT Opponent ${runId}-${++counter}` })
    .select("id")
    .single();
  const tournament = await service
    .from("tournaments")
    .insert({
      name: `IT Cup ${runId}-${++counter}`,
      format: "T20",
      start_date: "2031-01-01",
      end_date: "2031-12-31",
      status: "active",
    })
    .select("id")
    .single();
  if (venue.error || opponent.error || tournament.error) throw venue.error ?? opponent.error ?? tournament.error;
  await service
    .from("tournament_enrollments")
    .insert({ tournament_id: tournament.data.id, team_id: team.data.id, status: "enrolled" });

  const teamIds = [team.data.id, other.data.id];
  return {
    admin,
    admin2,
    mate1,
    mate2,
    outsider,
    pending,
    teamId: team.data.id,
    otherTeamId: other.data.id,
    tournamentId: tournament.data.id,
    opponentId: opponent.data.id,
    venueId: venue.data.id,
    async cleanup() {
      await service.from("matches").delete().in("our_team_id", teamIds);
      await service.from("tournaments").delete().eq("id", tournament.data.id);
      await service.from("teams").delete().in("id", teamIds);
      await service.from("opponents").delete().eq("id", opponent.data.id);
      await service.from("venues").delete().eq("id", venue.data.id);
      for (const u of [admin, admin2, mate1, mate2, outsider, pending]) {
        await service.auth.admin.deleteUser(u.id);
      }
    },
  };
}

let dateSeq = 0;
/** A unique far-future IST date per call, so tests never collide on the duplicate rule. */
export function futureDate(): string {
  const d = new Date(Date.UTC(2031, 0, 1) + (++dateSeq + (counter % 50) * 3) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function insertMatch(
  db: Db,
  fields: Partial<Database["public"]["Tables"]["matches"]["Insert"]> & {
    our_team_id: string;
    opponent_id: string;
    created_by: string;
  },
) {
  return db
    .from("matches")
    .insert({
      title: "Integration Match",
      category: "practice",
      match_date: futureDate(),
      start_time: "07:00",
      reporting_time: "06:30",
      starts_at: new Date().toISOString(), // recomputed by the database trigger
      ...fields,
    })
    .select("*")
    .single();
}
