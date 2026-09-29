import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-4xl" aria-hidden="true">
          📡
        </p>
        <h1 className="mt-3 text-2xl font-bold">You are offline</h1>
        <p className="text-muted mt-2">
          Match details and availability need a connection. Reconnect to the internet and try again.
        </p>
        {/* A full page load (not client navigation) is needed to retry while offline. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="bg-brand-700 mt-5 inline-block rounded-lg px-4 py-2 font-semibold text-white">
          Retry
        </a>
      </div>
    </main>
  );
}
