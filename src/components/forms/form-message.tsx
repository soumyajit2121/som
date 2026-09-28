"use client";

import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";

export function FormMessage({ state, retryHint = true }: { state: ActionResult; retryHint?: boolean }) {
  if (state.ok && state.message) return <Alert tone="success">{state.message}</Alert>;
  if (!state.ok) {
    return (
      <Alert tone="error">
        {state.error}
        {retryHint && state.code === "NETWORK" ? " You can submit the form again to retry." : null}
      </Alert>
    );
  }
  return null;
}
