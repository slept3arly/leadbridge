"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useHydrated } from "@/hooks/use-hydrated";
import { Check, X, Clock } from "lucide-react";

type FollowUpRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  dueTime: string | null;
  priority: string;
  status: string;
  lead: { id: string; displayName: string; leadNumber: string } | null;
  assignedUser: { id: string; name: string } | null;
};

export function TasksTableClient({ initialRows }: { initialRows: FollowUpRow[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [rows, setRows] = useState(initialRows);

  const [completeTarget, setCompleteTarget] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCompleteConfirm() {
    if (!completeTarget) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await axios.post(`/api/follow-ups/${completeTarget}/complete`, {});
      toast.success("Task completed");
      setCompleteTarget(null);
      router.refresh();
    } catch {
      setCompleteError("Failed to complete task. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await axios.delete(`/api/follow-ups/${cancelTarget}`);
      toast.success("Task cancelled");
      setCancelTarget(null);
      router.refresh();
    } catch {
      setCancelError("Failed to cancel task. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  function isOverdue(dueDate: Date | null) {
    if (!dueDate) return false;
    return hydrated && new Date(dueDate) < new Date();
  }

  return (
    <>
      <DataTable
        rows={rows}
        columns={[
          {
            key: "title",
            header: "Task",
            render: (fu: FollowUpRow) => (
              <div>
                <p className="font-semibold">{fu.title}</p>
                {fu.description && (
                  <p className="text-xs text-[var(--color-muted)] truncate max-w-xs">{fu.description}</p>
                )}
              </div>
            ),
          },
          {
            key: "lead",
            header: "Lead",
            render: (fu: FollowUpRow) => (
              <span className="font-medium">{fu.lead?.displayName ?? "Deleted"}</span>
            ),
          },
          {
            key: "dueDate",
            header: "Due",
            render: (fu: FollowUpRow) => {
              const overdue = isOverdue(fu.dueDate);
              return (
                <div className="flex items-center gap-1.5">
                  {overdue && <Clock size={14} className="text-red-500 shrink-0" />}
                  <span className={overdue ? "text-red-600 font-semibold" : ""}>
                    {fu.dueDate ? formatDate(fu.dueDate) : "-"}
                    {fu.dueTime ? ` ${fu.dueTime}` : ""}
                  </span>
                  {overdue && <Badge label="Overdue" />}
                </div>
              );
            },
          },
          {
            key: "priority",
            header: "Priority",
            render: (fu: FollowUpRow) => <Badge label={fu.priority} />,
          },
          {
            key: "assignedTo",
            header: "Assigned",
            render: (fu: FollowUpRow) => fu.assignedUser?.name ?? "Unassigned",
          },
          {
            key: "actions",
            header: "",
            render: (fu: FollowUpRow) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={completing && completeTarget === fu.id}
                  onClick={() => {
                    setCompleteError(null);
                    setCompleteTarget(fu.id);
                  }}
                  title="Mark completed"
                >
                  <Check size={14} className="text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={cancelling && cancelTarget === fu.id}
                  onClick={() => {
                    setCancelError(null);
                    setCancelTarget(fu.id);
                  }}
                  title="Mark missed"
                >
                  <X size={14} className="text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <ConfirmDialog
        open={completeTarget !== null}
        title="Complete task?"
        description="Mark this task as completed?"
        confirmLabel="Complete"
        cancelLabel="Cancel"
        variant="default"
        isLoading={completing}
        error={completeError}
        onConfirm={handleCompleteConfirm}
        onCancel={() => { setCompleteTarget(null); setCompleteError(null); }}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel task?"
        description="This will cancel the task. This action cannot be undone."
        confirmLabel="Cancel Task"
        cancelLabel="Keep Task"
        variant="destructive"
        isLoading={cancelling}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onCancel={() => { setCancelTarget(null); setCancelError(null); }}
      />
    </>
  );
}
