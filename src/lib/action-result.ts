import type { FieldErrors } from "@/lib/validation/schemas";

export type ActionFailure = { ok: false; error: string; code?: string; fieldErrors?: FieldErrors };
export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | ActionFailure;

export const initialActionState: ActionResult = { ok: true };
