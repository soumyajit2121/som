import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { PushSender } from "./dispatch";
import { createWebPushSenderFromKeys } from "./web-push-core";

export function createWebPushSender(): PushSender {
  return createWebPushSenderFromKeys({
    publicKey: publicEnv.vapidPublicKey(),
    privateKey: serverEnv.vapidPrivateKey(),
    subject: serverEnv.vapidSubject(),
  });
}
