"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { announcementSchema } from "@/lib/validation/schemas";
import { dbFailure, parseForm, validationFailure, withSession } from "@/server/action-utils";
import { dispatchPushSoon } from "@/server/dispatch-now";

function revalidate() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function setNotificationReadAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const input = z
    .object({ id: z.uuid(), read: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), read: formData.get("read") });
  if (!input.success) return { ok: false, error: "Invalid request." };
  return withSession(async ({ supabase, userId }) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: input.data.read === "true" ? new Date().toISOString() : null })
      .eq("id", input.data.id)
      .eq("recipient_id", userId);
    if (error) return dbFailure(error);
    revalidate();
    return { ok: true };
  });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return withSession(async ({ supabase, userId }) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) return dbFailure(error);
    revalidate();
    return { ok: true, message: "All notifications marked as read." };
  });
}

export async function postAnnouncementAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return withSession(
    async ({ supabase }) => {
      const parsed = parseForm(announcementSchema, formData);
      if (!parsed.success) return validationFailure(parsed.error);
      const { data, error } = await supabase.rpc("post_announcement", {
        p_title: parsed.data.title,
        p_body: parsed.data.body,
      });
      if (error) return dbFailure(error);
      dispatchPushSoon();
      revalidate();
      return { ok: true, message: `Announcement sent to ${data ?? 0} member(s).` };
    },
    { admin: true },
  );
}

export async function sendTestNotificationAction(): Promise<ActionResult> {
  return withSession(async ({ supabase }) => {
    const { error } = await supabase.rpc("send_test_notification");
    if (error) return dbFailure(error);
    dispatchPushSoon();
    revalidate();
    return {
      ok: true,
      message: "Test notification created. It appears in your notification centre and on devices with push enabled.",
    };
  });
}
