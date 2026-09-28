import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Create an account</h1>
      <SignUpForm />
    </>
  );
}
