"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { preferencesSchema, profileSchema } from "@/lib/validation/schemas";
import { dbFailure, parseForm, validationFailure, withSession } from "@/server/action-utils";

/** Users edit only their own profile: the target id always comes from the session. */
export async function updateProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, userId }) => {
    const parsed = parseForm(profileSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("id", userId);
    if (error) return dbFailure(error);
    const { error: privateError } = await supabase
      .from("profile_private")
      .update({ phone: parsed.data.phone ?? null })
      .eq("profile_id", userId);
    if (privateError) return dbFailure(privateError);
    revalidatePath("/profile");
    return { ok: true, message: "Profile saved." };
  });
}

export async function updatePreferencesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(async ({ supabase, userId }) => {
    const parsed = parseForm(preferencesSchema, formData);
    if (!parsed.success) return validationFailure(parsed.error);
    const { error } = await supabase
      .from("notification_preferences")
      .update({
        push_operational_alerts: parsed.data.pushOperationalAlerts,
        push_match_updates: parsed.data.pushMatchUpdates,
        push_player_confirmations: parsed.data.pushPlayerConfirmations,
        push_announcements: parsed.data.pushAnnouncements,
      })
      .eq("profile_id", userId);
    if (error) return dbFailure(error);
    revalidatePath("/profile");
    return { ok: true, message: "Notification preferences saved." };
  });
}

export async function removeDeviceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Invalid device." };
  return withSession(async ({ supabase, userId }) => {
    const { error } = await supabase.from("push_subscriptions").delete().eq("id", id.data).eq("profile_id", userId);
    if (error) return dbFailure(error);
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", userId);
    if (!count) {
      await supabase.from("notification_preferences").update({ push_enabled: false }).eq("profile_id", userId);
    }
    revalidatePath("/profile");
    return { ok: true, message: "Device removed." };
  });
}
