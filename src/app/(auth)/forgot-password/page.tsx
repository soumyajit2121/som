import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Reset your password</h1>
      <p className="text-muted mb-4 text-sm">Enter your email and we will send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
