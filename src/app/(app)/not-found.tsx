import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This page does not exist, or you do not have access to it."
      action={
        <Link href="/" className="text-brand-700 font-semibold underline">
          Back to dashboard
        </Link>
      }
    />
  );
}
