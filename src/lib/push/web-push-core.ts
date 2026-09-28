import webpush from "web-push";
import type { PushSender } from "./dispatch";

export function createWebPushSenderFromKeys(keys: {
  publicKey: string;
  privateKey: string;
  subject: string;
}): PushSender {
  const configured = Boolean(keys.publicKey && keys.privateKey);
  return {
    configured,
    async send(subscription, payload) {
      const res = await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        {
          TTL: 60 * 60 * 12,
          urgency: "high",
          vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
        },
      );
      return { statusCode: res.statusCode };
    },
  };
}
