import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { json, jsonError } from "@/lib/http";
import { createWebPushSender } from "@/lib/push/web-push-sender";
import { runScheduledJobs } from "@/lib/scheduler";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Scheduler entry point (Vercel Cron, GitHub Actions or pg_cron).
 * Requires "Authorization: Bearer $CRON_SECRET". Safe to call repeatedly.
 */
async function handle(request: NextRequest) {
  if (!authorized(request)) return jsonError(401, "Unauthorized");
  try {
    const result = await runScheduledJobs(createAdminClient(), createWebPushSender(), new Date());
    return json(result);
  } catch (error) {
    console.error("Scheduled run failed:", error instanceof Error ? error.message : "unknown error");
    return jsonError(500, "Scheduled run failed");
  }
}

export const GET = handle;
export const POST = handle;
