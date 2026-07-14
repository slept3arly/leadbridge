"use client";

import axios from "axios";
import { Button } from "@/components/ui/button";

export function LeadDeleteButton({ leadId }: { leadId: string }) {
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await axios.delete(`/api/leads/${leadId}`);
        window.location.reload();
      }}
    >
      Delete
    </Button>
  );
}
