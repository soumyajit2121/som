"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteSchema,
  membershipSchema,
  opponentSchema,
  teamSchema,
  userAdminSchema,
  venueSchema,
} from "@/lib/validation/schemas";
import { dbFailure, parseForm, validationFailure, withSession } from "@/server/action-utils";

const admin = { admin: true } as const;

// ---------------------------------------------------------------------------
// Users: approve, promote/demote, deactivate, invite
// ---------------------------------------------------------------------------
export async function updateUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const parsed = parseForm(userAdminSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const { profileId, role, status } = parsed.data;
    const update: { role?: string; status?: "pending" | "active" | "inactive" } = {};
    if (role) update.role = role;
    if (status) update.status = status;
    if (!Object.keys(update).length) return { ok: false, error: "Nothing to change." };
    const { error, count } = await supabase.from("profiles").update(update, { count: "exact" }).eq("id", profileId);
    if (error) return dbFailure(error);
    if (!count) return { ok: false, error: "User not found." };
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: role
        ? `Role changed to ${role === "admin" ? "Administrator" : "Teammate"}.`
        : status === "active"
          ? "Account approved."
          : status === "inactive"
            ? "Account deactivated. The user can no longer access team information."
            : "Account updated.",
    };
  }, admin);
}

export async function inviteUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const parsed = parseForm(inviteSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: false, error: "Invitations need SUPABASE_SERVICE_ROLE_KEY on the server." };
    }
    // The caller is a verified administrator; only now is the service role used.
    const service = createAdminClient();
    const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { display_name: parsed.data.displayName },
      redirectTo: `${publicEnv.siteUrl()}/auth/callback?next=/reset-password`,
    });
    if (error || !data.user) {
      return {
        ok: false,
        error: /already/i.test(error?.message ?? "")
          ? "A user with this email already exists."
          : "Could not send the invitation.",
      };
    }
    // Invited users are pre-approved by the inviting administrator.
    const { error: approveError } = await supabase.from("profiles").update({ status: "active" }).eq("id", data.user.id);
    if (approveError) return dbFailure(approveError, "Invitation sent, but approval failed.");
    if (parsed.data.teamId) {
      await supabase.from("team_memberships").insert({ team_id: parsed.data.teamId, profile_id: data.user.id });
    }
    revalidatePath("/admin/users");
    return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
  }, admin);
}

// ---------------------------------------------------------------------------
// Teams and memberships (unlimited squad size)
// ---------------------------------------------------------------------------
export async function saveTeamAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, userId }) => {
    const parsed = parseForm(teamSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const id = z.uuid().safeParse(formData.get("id"));
    const row = {
      name: parsed.data.name,
      short_name: parsed.data.shortName ?? null,
      description: parsed.data.description ?? null,
    };
    const { error } = id.success
      ? await supabase.from("teams").update(row).eq("id", id.data)
      : await supabase.from("teams").insert({ ...row, created_by: userId });
    if (error) return dbFailure(error);
    revalidatePath("/teams");
    revalidatePath("/admin/teams");
    return { ok: true, message: id.success ? "Team updated." : "Team created." };
  }, admin);
}

export async function setTeamActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ id: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(async ({ supabase }) => {
    const { error } = await supabase
      .from("teams")
      .update({ is_active: input.data.active === "true" })
      .eq("id", input.data.id);
    if (error) return dbFailure(error);
    revalidatePath("/teams");
    revalidatePath("/admin/teams");
    return { ok: true, message: input.data.active === "true" ? "Team reactivated." : "Team deactivated." };
  }, admin);
}

export async function saveMembershipAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const parsed = parseForm(membershipSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const { error } = await supabase.from("team_memberships").upsert(
      {
        team_id: parsed.data.teamId,
        profile_id: parsed.data.profileId,
        squad_role: parsed.data.squadRole,
        is_active: true,
        left_at: null,
      },
      { onConflict: "team_id,profile_id" },
    );
    if (error) return dbFailure(error);
    revalidatePath(`/teams/${parsed.data.teamId}`);
    return { ok: true, message: "Squad updated." };
  }, admin);
}

export async function removeMembershipAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ teamId: z.uuid(), profileId: z.uuid() })
    .safeParse({ teamId: formData.get("teamId"), profileId: formData.get("profileId") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(async ({ supabase }) => {
    const { error } = await supabase
      .from("team_memberships")
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq("team_id", input.data.teamId)
      .eq("profile_id", input.data.profileId);
    if (error) return dbFailure(error);
    revalidatePath(`/teams/${input.data.teamId}`);
    return { ok: true, message: "Player removed from the squad." };
  }, admin);
}

// ---------------------------------------------------------------------------
// Venues and opponents
// ---------------------------------------------------------------------------
export async function saveVenueAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const parsed = parseForm(venueSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const id = z.uuid().safeParse(formData.get("id"));
    const row = {
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      maps_url: parsed.data.mapsUrl ?? null,
      notes: parsed.data.notes ?? null,
    };
    const { error } = id.success
      ? await supabase.from("venues").update(row).eq("id", id.data)
      : await supabase.from("venues").insert(row);
    if (error) return dbFailure(error);
    revalidatePath("/admin/venues");
    return { ok: true, message: id.success ? "Venue updated." : "Venue added." };
  }, admin);
}

export async function saveOpponentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, userId }) => {
    const parsed = parseForm(opponentSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const id = z.uuid().safeParse(formData.get("id"));
    const row = { name: parsed.data.name, notes: parsed.data.notes ?? null };
    const { error } = id.success
      ? await supabase.from("opponents").update(row).eq("id", id.data)
      : await supabase.from("opponents").insert({ ...row, created_by: userId });
    if (error) return dbFailure(error);
    revalidatePath("/admin/opponents");
    return { ok: true, message: id.success ? "Opponent updated." : "Opponent added." };
  }, admin);
}

export async function setActiveFlagAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ table: z.enum(["venues", "opponents"]), id: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ table: formData.get("table"), id: formData.get("id"), active: formData.get("active") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(async ({ supabase }) => {
    const { error } = await supabase
      .from(input.data.table)
      .update({ is_active: input.data.active === "true" })
      .eq("id", input.data.id);
    if (error) return dbFailure(error);
    revalidatePath(`/admin/${input.data.table}`);
    return { ok: true, message: "Saved." };
  }, admin);
}
