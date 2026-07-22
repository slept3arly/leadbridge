import { Navbar } from "@/components/shared/navbar";
import { AdminReports } from "@/components/admin/admin-reports";

export default function AdminReportsPage() {
  return (
    <>
      <Navbar title="Reports" />
      <AdminReports />
    </>
  );
}
