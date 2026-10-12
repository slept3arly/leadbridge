import { AdminReports } from "@/components/admin/admin-reports";

export default function AdminReportsPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return <AdminReports initialRange={{ from: from.toISOString(), to: to.toISOString() }} />;
}
