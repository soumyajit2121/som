"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { initialActionState } from "@/lib/action-result";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/schemas";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Runs the Zod schema in the browser first (fast feedback), then calls the
 * server action, which validates again and is authoritative.
 *
 * Submitting through onSubmit (instead of <form action>) keeps what the user
 * typed when validation fails, because React would otherwise reset the form.
 */
export function useValidatedAction(action: Action, schema?: z.ZodType) {
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(async (prev, formData) => {
    if (schema) {
      const parsed = schema.safeParse(formDataToObject(formData));
      if (!parsed.success) {
        return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
      }
    }
    try {
      return await action(prev, formData);
    } catch (error) {
      if (isRedirect(error)) throw error;
      return {
        ok: false,
        error: "The server could not be reached. Check your connection and try again.",
        code: "NETWORK",
      };
    }
  }, initialActionState);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formProps: { onSubmit, noValidate: true } as const };
}
