import { Navbar } from "@/components/navbar";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminSettingsPage() {
  return (
    <>
      <Navbar title="Settings" />
      <EmptyState title="Settings scaffolded" description="Configuration storage is modeled and the route surface is ready for future company-level CRM settings." />
    </>
  );
}
