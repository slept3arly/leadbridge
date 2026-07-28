import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { AdminSettings } from "@/components/admin/admin-settings";

export default function AdminSettingsPage() {
  return (
    <>
      <Navbar
        title="Settings"
        actions={
          <>
            <SignOutButton />
          </>
        }
      />
      <AdminSettings />
    </>
  );
}
