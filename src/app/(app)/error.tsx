"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="error" title="Something went wrong">
        The page could not be loaded. This is usually a temporary connection problem.
      </Alert>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
