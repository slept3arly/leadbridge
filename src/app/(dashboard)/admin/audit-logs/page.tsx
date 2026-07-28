import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportButton } from "@/components/shared/export-button";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";

export default async function AdminAuditLogsPage() {
  return (
    <>
      <Navbar
        title="Audit Logs"
        showResync
        actions={
          <>
            <ExportButton type="audit-logs" iconOnly />
            <SignOutButton />
          </>
        }
      />
      <AuditLogViewer />
    </>
  );
}
