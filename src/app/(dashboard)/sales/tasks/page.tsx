import { Navbar } from "@/components/navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { TasksTableClient } from "@/components/tasks-table-client";
import { requireSession } from "@/lib/session";
import { followUpService } from "@/services/follow-up.service";

export default async function SalesTasksPage() {
  const { user } = await requireSession("SALES");
  const followUps = await followUpService.listForTasks(user);

  return (
    <>
      <Navbar title="Tasks" showResync />
      {followUps.length ? (
        <TasksTableClient initialRows={followUps as any} />
      ) : (
        <EmptyState
          title="No pending tasks"
          description="Create a follow-up from a lead to see it here."
        />
      )}
    </>
  );
}
