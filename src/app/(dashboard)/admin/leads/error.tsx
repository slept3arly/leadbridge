"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function AdminLeadsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <ErrorState message="We could not load leads. Please try again." />
      <Button variant="secondary" onClick={reset}>Try again</Button>
    </div>
  );
}
