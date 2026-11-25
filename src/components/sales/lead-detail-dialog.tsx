"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LeadDetailsModal } from "@/components/sales/lead-details-modal";

export function LeadDetailDialog({
  currentUserId,
  isAdmin,
  canArchive,
  canDelete = false,
  hideFollowUpActions = false,
  leadSources,
}: {
  currentUserId: string;
  isAdmin: boolean;
  canArchive: boolean;
  canDelete?: boolean;
  hideFollowUpActions?: boolean;
  leadSources?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("leadId");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  if (!leadId) return null;

  return (
    <LeadDetailsModal
      leadId={leadId}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      canArchive={canArchive}
      canDelete={canDelete}
      hideFollowUpActions={hideFollowUpActions}
      leadSources={leadSources}
      onClose={handleClose}
      onUpdate={() => router.refresh()}
    />
  );
}
