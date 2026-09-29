import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getSession } from "@/lib/auth";
import AuthLayout from "../(auth)/layout";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?error=link");
  return (
    <AuthLayout>
      <h1 className="mb-4 text-2xl font-bold">Choose a new password</h1>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
