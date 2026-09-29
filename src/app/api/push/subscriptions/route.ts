import type { NextRequest } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/auth";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";

/** Registers this browser/device for web push for the signed-in user. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, "Cross-site request rejected");
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid subscription");
  const { endpoint, keys, deviceLabel } = parsed.data;

  // A browser endpoint belongs to exactly one account. If this device was
  // previously registered by someone else (shared phone), move it over.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await createAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .neq("profile_id", session.userId);
  }
  const { error } = await session.supabase.from("push_subscriptions").upsert(
    {
      profile_id: session.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_label: deviceLabel ?? null,
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );
  if (error) return jsonError(400, "Could not save this device");
  await session.supabase
    .from("notification_preferences")
    .update({ push_enabled: true })
    .eq("profile_id", session.userId);
  return json({ ok: true }, 201);
}

/** Removes this device's subscription (the user's own only). */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, "Cross-site request rejected");
  const session = await getActiveSession();
  if (!session) return jsonError(401, "Authentication required");
  const body = z.object({ endpoint: z.url().max(2048) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request");
  await session.supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.data.endpoint)
    .eq("profile_id", session.userId);
  const { count } = await session.supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", session.userId);
  if (!count) {
    await session.supabase
      .from("notification_preferences")
      .update({ push_enabled: false })
      .eq("profile_id", session.userId);
  }
  return json({ ok: true });
}
