"use client";

import { useState } from "react";
import axios from "axios";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
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
  const [rows, setRows] = useState(initialRows);

  async function updateStatus(id: string, status: string) {
    try {
      await axios.patch(`/api/follow-ups/${id}`, { status });
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success(status === "COMPLETED" ? "Task completed" : "Task missed");
    } catch {
      toast.error("Failed to update task");
    }
  }

  function isOverdue(dueDate: Date | null) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  return (
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
                onClick={() => updateStatus(fu.id, "COMPLETED")}
                title="Mark completed"
              >
                <Check size={14} className="text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus(fu.id, "CANCELLED")}
                title="Mark missed"
              >
                <X size={14} className="text-red-500" />
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}
