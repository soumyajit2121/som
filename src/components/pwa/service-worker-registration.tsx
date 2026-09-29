"use client";

import { useEffect } from "react";

/** Registers the service worker. It never asks for notification permission. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Registration failure only disables offline/push features.
    });
  }, []);
  return null;
}
