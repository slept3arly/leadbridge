import { Navbar } from "@/components/navbar";
import { AdminSettings } from "@/components/admin-settings";

export default function AdminSettingsPage() {
  return (
    <>
      <Navbar title="Settings" />
      <AdminSettings />
    </>
  );
}
