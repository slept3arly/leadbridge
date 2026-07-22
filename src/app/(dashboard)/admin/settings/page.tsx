import { Navbar } from "@/components/shared/navbar";
import { AdminSettings } from "@/components/admin/admin-settings";

export default function AdminSettingsPage() {
  return (
    <>
      <Navbar title="Settings" />
      <AdminSettings />
    </>
  );
}
