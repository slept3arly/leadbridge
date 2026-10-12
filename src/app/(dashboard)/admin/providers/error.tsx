"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function ProvidersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="space-y-3"><ErrorState message="Could not load providers. Please try again." /><Button variant="secondary" onClick={reset}>Try again</Button></div>;
}
