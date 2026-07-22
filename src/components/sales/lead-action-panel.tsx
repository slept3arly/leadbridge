"use client";

import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Archive, Trash2 } from "lucide-react";

export function LeadActionPanel({
  onDetails,
  onArchive,
  onDelete,
  isArchiving,
  isDeleting,
  canDelete = true,
  canArchive = true,
}: {
  onDetails: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
  canDelete?: boolean;
  canArchive?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 min-w-[130px]">
      <Button
        variant="secondary"
        size="sm"
        className="col-span-2 w-full gap-1.5"
        onClick={onDetails}
      >
        Details
      </Button>
      {canArchive ? (
        <IconActionButton
          icon={Archive}
          label="Archive lead"
          onClick={onArchive}
          isLoading={isArchiving}
          className="w-full"
        />
      ) : (
        <div />
      )}
      {canDelete ? (
        <IconActionButton
          icon={Trash2}
          label="Delete lead"
          onClick={onDelete}
          isLoading={isDeleting}
          className="w-full"
        />
      ) : (
        <div />
      )}
    </div>
  );
}
