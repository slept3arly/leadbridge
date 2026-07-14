"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function LeadRestoreButton({ leadId }: { leadId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="secondary"
      size="sm"
      isLoading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await axios.post(`/api/leads/${leadId}/restore`);
          toast.success("Lead restored");
          window.location.reload();
        } catch {
          toast.error("Failed to restore lead");
          setPending(false);
        }
      }}
    >
      Restore
    </Button>
  );
}
