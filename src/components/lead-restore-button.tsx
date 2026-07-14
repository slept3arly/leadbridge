"use client";

import axios from "axios";
import { Button } from "@/components/ui/button";

export function LeadRestoreButton({ leadId }: { leadId: string }) {
  return <Button variant="secondary" onClick={() => axios.post(`/api/leads/${leadId}/restore`).then(() => window.location.reload())}>Restore</Button>;
}
