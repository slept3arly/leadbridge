"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function LeadRestoreButton({ leadId }: { leadId: string }) {
  const router = useRouter();
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
          router.refresh();
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
