import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { signOutAction } from "@/server/actions/auth";
import AuthLayout from "../(auth)/layout";

export const metadata: Metadata = { title: "Awaiting approval" };

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.status === "active") redirect("/");
  const inactive = session.profile?.status === "inactive";
  return (
    <AuthLayout>
      <h1 className="mb-3 text-2xl font-bold">{inactive ? "Account deactivated" : "Waiting for approval"}</h1>
      {inactive ? (
        <Alert tone="warning">
          Your account has been deactivated by an administrator, so team information is no longer available. Contact a
          team administrator if you believe this is a mistake.
        </Alert>
      ) : (
        <Alert tone="info">
          Thanks for signing up{session.profile ? `, ${session.profile.displayName}` : ""}. A team administrator needs
          to approve your account before you can see tournaments, matches and teammates.
        </Alert>
      )}
      <form action={signOutAction} className="mt-4">
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthLayout>
  );
}
