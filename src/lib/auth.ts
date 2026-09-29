import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { ProfileStatus } from "@/lib/labels";

export interface SessionProfile {
  id: string;
  displayName: string;
  role: "admin" | "teammate";
  status: ProfileStatus;
}

export interface Session {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
  profile: SessionProfile | null;
}

/** Validates the session with Supabase Auth (not just the cookie) once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle();
  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile: profile
      ? {
          id: profile.id,
          displayName: profile.display_name,
          role: profile.role === "admin" ? "admin" : "teammate",
          status: profile.status,
        }
      : null,
  };
});

export interface ActiveSession extends Session {
  profile: SessionProfile;
  isAdmin: boolean;
}

/** For pages: redirects unauthenticated or unapproved users. */
export async function requireActiveSession(): Promise<ActiveSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile || session.profile.status !== "active") redirect("/pending");
  return { ...session, profile: session.profile, isAdmin: session.profile.role === "admin" };
}

export async function requireAdminSession(): Promise<ActiveSession> {
  const session = await requireActiveSession();
  if (!session.isAdmin) redirect("/?denied=admin");
  return session;
}

/** For server actions and route handlers: returns null instead of redirecting. */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const session = await getSession();
  if (!session?.profile || session.profile.status !== "active") return null;
  return { ...session, profile: session.profile, isAdmin: session.profile.role === "admin" };
}
