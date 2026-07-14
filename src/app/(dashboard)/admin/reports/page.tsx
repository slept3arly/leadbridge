import { Navbar } from "@/components/navbar";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminReportsPage() {
  return (
    <>
      <Navbar title="Reports" />
      <EmptyState title="Reporting scaffolded" description="The endpoint structure is in place. Analytics views will land on top of the current schema and service layer." />
    </>
  );
}
