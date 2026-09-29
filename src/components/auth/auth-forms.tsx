"use client";

import Link from "next/link";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Field, Input } from "@/components/ui/form";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/server/actions/auth";

export function SignInForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useValidatedAction(signInAction, signInSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field name="email" label="Email" errors={errors?.email} required>
        {(p) => <Input type="email" autoComplete="email" {...p} />}
      </Field>
      <Field name="password" label="Password" errors={errors?.password} required>
        {(p) => <Input type="password" autoComplete="current-password" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-brand-700 underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const { state, pending, formProps } = useValidatedAction(signUpAction, signUpSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  if (state.ok && state.message) return <FormMessage state={state} />;
  return (
    <form {...formProps} className="space-y-4">
      <Field name="displayName" label="Display name" errors={errors?.displayName} required hint="Shown to teammates.">
        {(p) => <Input autoComplete="name" maxLength={80} {...p} />}
      </Field>
      <Field name="email" label="Email" errors={errors?.email} required>
        {(p) => <Input type="email" autoComplete="email" {...p} />}
      </Field>
      <Field name="password" label="Password" errors={errors?.password} required hint="At least 8 characters.">
        {(p) => <Input type="password" autoComplete="new-password" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-muted text-sm">
        New accounts must be approved by an administrator before team information becomes visible.{" "}
        <Link href="/login" className="text-brand-700 underline">
          Already registered? Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, pending, formProps } = useValidatedAction(forgotPasswordAction, forgotPasswordSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-4">
      <Field name="email" label="Email" errors={errors?.email} required>
        {(p) => <Input type="email" autoComplete="email" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
      <Link href="/login" className="text-brand-700 block text-center text-sm underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const { state, pending, formProps } = useValidatedAction(resetPasswordAction, resetPasswordSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-4">
      <Field name="password" label="New password" errors={errors?.password} required hint="At least 8 characters.">
        {(p) => <Input type="password" autoComplete="new-password" {...p} />}
      </Field>
      <Field name="confirmPassword" label="Confirm new password" errors={errors?.confirmPassword} required>
        {(p) => <Input type="password" autoComplete="new-password" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Updating…">
        Set password
      </SubmitButton>
    </form>
  );
}
