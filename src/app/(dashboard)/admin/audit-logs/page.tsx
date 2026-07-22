import { Navbar } from "@/components/shared/navbar";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";

export default async function AdminAuditLogsPage() {
  return (
    <>
      <Navbar title="Audit Logs" />
      <AuditLogViewer />
    </>
  );
}
