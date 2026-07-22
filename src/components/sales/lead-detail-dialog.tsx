"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadDetailsModal } from "@/components/sales/lead-details-modal";

export function LeadDetailDialog({
  leadId: initialLeadId,
  currentUserId,
  isAdmin,
  canArchive,
}: {
  leadId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(!!initialLeadId);
  const [leadId, setLeadId] = useState<string | null>(initialLeadId);
  const router = useRouter();

  const handleClose = () => {
    setOpen(false);
    setLeadId(null);
    router.replace("/sales/my-leads");
  };

  if (!open || !leadId) return null;

  return (
    <LeadDetailsModal
      leadId={leadId}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      canArchive={canArchive}
      onClose={handleClose}
    />
  );
}
