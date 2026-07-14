import { Navbar } from "@/components/navbar";
import { EmptyState } from "@/components/ui/empty-state";

export default function SalesTasksPage() {
  return (
    <>
      <Navbar title="Tasks" />
      <EmptyState title="Task workflows are next" description="This shell is reserved for future reminders, follow-ups, and automation-assisted tasking." />
    </>
  );
}
