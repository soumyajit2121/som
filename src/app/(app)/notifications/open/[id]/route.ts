import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/auth";
import { safeRelativePath } from "@/lib/utils";

/** Marks one of the user's notifications as read and follows its deep link. */
export async function GET(request: NextRequest, ctx: RouteContext<"/notifications/open/[id]">) {
  const { id } = await ctx.params;
  const session = await getActiveSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!z.uuid().safeParse(id).success) return NextResponse.redirect(new URL("/notifications", request.url));

  const { data } = await session.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", session.userId)
    .select("link_path")
    .maybeSingle();
  const target = safeRelativePath(data?.link_path, "/notifications");
  return NextResponse.redirect(new URL(target, request.url));
}
