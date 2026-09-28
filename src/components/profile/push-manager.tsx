"use client";

import { BellRing, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendTestNotificationAction } from "@/server/actions/notifications";

type Support = "checking" | "unsupported" | "needs-install" | "supported";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac/i.test(ua)
          ? "macOS"
          : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${browser} on ${os}`;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/**
 * Push opt-in. Permission is requested only after the user presses
 * "Enable mobile notifications", never on page load.
 */
export function PushManager({ vapidPublicKey }: { vapidPublicKey: string }) {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const test = useValidatedAction(sendTestNotificationAction);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iPhone|iPad/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    queueMicrotask(async () => {
      if (!supported) {
        setSupport(ios && !standalone ? "needs-install" : "unsupported");
        return;
      }
      setSupport("supported");
      setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    });
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      const reg = await getRegistration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, deviceLabel: deviceLabel() }),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
      router.refresh();
    } catch {
      setError("Could not enable notifications on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      router.refresh();
    } catch {
      setError("Could not disable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-brand-50 flex gap-3 rounded-lg p-3 text-sm">
        <BellRing className="text-brand-700 mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Mobile notifications tell you straight away when a match changes or is cancelled, and warn administrators 25
          hours before a match that is short of players or still has a placeholder opponent. Everything also appears in
          the in-app notification centre.
        </p>
      </div>

      {!vapidPublicKey ? (
        <Alert tone="warning">
          Push notifications are not configured on this server yet. In-app notifications still work.
        </Alert>
      ) : support === "checking" ? (
        <p className="text-muted text-sm" role="status">
          Checking this device…
        </p>
      ) : support === "needs-install" ? (
        <Alert tone="info" title="Install the app first">
          On iPhone and iPad, push notifications work only after adding this app to your Home Screen: tap Share, then
          “Add to Home Screen”, then open the app from the Home Screen and return here.
        </Alert>
      ) : support === "unsupported" ? (
        <Alert tone="info">
          This browser does not support push notifications. You will still see every notification in the app.
        </Alert>
      ) : permission === "denied" ? (
        <Alert tone="warning" title="Notifications are blocked for this site">
          To turn them back on, open your browser&apos;s site settings for this app (the lock icon next to the address,
          or Settings → Site settings → Notifications on Android), allow notifications, then reload this page.
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm" data-testid="push-status">
            <Smartphone className="mr-1 inline h-4 w-4" aria-hidden="true" />
            This device: {subscribed ? "notifications enabled" : "notifications off"}
          </p>
          {subscribed ? (
            <Button variant="secondary" onClick={disable} disabled={busy}>
              Disable on this device
            </Button>
          ) : (
            <Button onClick={enable} disabled={busy}>
              Enable mobile notifications
            </Button>
          )}
        </div>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <form {...test.formProps}>
        <SubmitButton variant="secondary" size="sm" pending={test.pending} pendingText="Sending…">
          Send a test notification
        </SubmitButton>
        <div className="mt-2">
          <FormMessage state={test.state} />
        </div>
      </form>
    </div>
  );
}
