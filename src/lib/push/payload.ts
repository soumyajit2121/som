import type { NotificationType } from "@/lib/labels";
import { safeRelativePath } from "@/lib/utils";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Lock-screen payloads carry the minimum necessary information and never any
 * private player details (names of other players, phone numbers, emails).
 */
export function buildPushPayload(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string | null;
}): PushPayload {
  const url = safeRelativePath(n.linkPath, "/notifications");
  const body = n.type === "player_confirmed" ? "A player confirmed for a match. Tap to view." : n.body;
  return {
    title: n.title.slice(0, 80),
    body: body.length > 240 ? `${body.slice(0, 237)}...` : body,
    url,
    tag: n.id,
  };
}
