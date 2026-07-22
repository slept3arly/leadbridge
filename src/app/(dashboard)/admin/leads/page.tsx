import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportButton } from "@/components/shared/export-button";
import { AdminLeadsPageContent, type SerializedLead } from "@/components/leads/admin-leads-page-content";
import { prisma } from "@/lib/prisma";
import { leadService } from "@/services/lead.service";
import { userService } from "@/services/user.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";
import type { TableQueryState } from "@/hooks/use-table-query";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseListQuery(toSearchParams(resolvedSearchParams));
  const [result, assignableUsers] = await Promise.all([
    leadService.listPage(query),
    userService.listAssignable(),
  ]);
  const leads = result.data;

  const leadSources = await prisma.leadSource.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const tableInitial: Partial<TableQueryState> = {
    search: query.search ?? "",
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    filters: Object.fromEntries(
      Object.entries(query.filters).map(([key, value]) => [key, value.join(",")])
    ),
    dateFrom: query.dateFrom?.toISOString(),
    dateTo: query.dateTo?.toISOString(),
  };

  const serializedLeads: SerializedLead[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company,
    email: l.email,
    phone: l.phone,
    city: l.city,
    state: l.state,
    product: l.product,
    requirement: l.requirement,
    status: l.status,
    priority: l.priority,
    category: l.category,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    assignedUser: l.assignedUser ?? null,
    source: l.source ?? null,
  }));

  return (
    <>
      <Navbar
        title="Lead Management"
        showResync
        actions={
          <>
            <ExportButton type="leads" iconOnly />
            <SignOutButton />
          </>
        }
      />
      <AdminLeadsPageContent
        leads={serializedLeads}
        initial={tableInitial}
        pagination={result.pagination}
        leadSources={leadSources}
        assignableUsers={assignableUsers}
      />
    </>
  );
}
