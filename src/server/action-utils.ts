import "server-only";
import type { z } from "zod";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { getActiveSession, type ActiveSession } from "@/lib/auth";
import { dbErrorCode, friendlyDbError, type DbErrorLike } from "@/lib/errors";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/schemas";

export function validationFailure(error: z.ZodError): ActionFailure {
  return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsOf(error) };
}

export function dbFailure(error: DbErrorLike, fallback?: string): ActionFailure {
  return { ok: false, error: friendlyDbError(error, fallback), code: dbErrorCode(error) ?? undefined };
}

export const notSignedIn: ActionFailure = {
  ok: false,
  error: "Your session has expired or your account is not approved. Please sign in again.",
  code: "UNAUTHENTICATED",
};

export const forbidden: ActionFailure = {
  ok: false,
  error: "You are not allowed to perform this action.",
  code: "FORBIDDEN",
};

/** Parses FormData with a schema. Server-side validation is authoritative. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData) {
  return schema.safeParse(formDataToObject(formData));
}

export async function withSession<T>(
  fn: (session: ActiveSession) => Promise<ActionResult<T>>,
  opts: { admin?: boolean } = {},
): Promise<ActionResult<T>> {
  const session = await getActiveSession();
  if (!session) return notSignedIn;
  if (opts.admin && !session.isAdmin) return forbidden;
  return fn(session);
}
