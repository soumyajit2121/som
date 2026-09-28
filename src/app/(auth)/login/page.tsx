import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/alert";
import { safeRelativePath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeRelativePath(typeof sp.next === "string" ? sp.next : null, "/");
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      {sp.signedOut ? (
        <Alert tone="success" className="mb-4">
          You have been signed out.
        </Alert>
      ) : null}
      {sp.error ? (
        <Alert tone="error" className="mb-4">
          That link is invalid or has expired. Please try again.
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </>
  );
}
