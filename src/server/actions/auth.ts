"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/utils";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { parseForm, validationFailure } from "@/server/action-utils";

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One generic message: never reveal whether the email exists.
    return { ok: false, error: "Incorrect email or password." };
  }
  redirect(safeRelativePath(formData.get("next") as string | null, "/"));
}

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv.siteUrl()}/auth/callback?next=/pending`,
    },
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "weak_password" ? "Please choose a stronger password." : "Sign-up failed. Please try again.",
    };
  }
  if (data.session) redirect("/pending");
  return {
    ok: true,
    message: "Check your email to confirm your address. An administrator will then approve your account.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?signedOut=1");
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a password-reset link has been sent." };
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "same_password"
          ? "Choose a password different from your current one."
          : "Could not update the password.",
    };
  }
  redirect("/?passwordUpdated=1");
}
