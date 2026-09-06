import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { ExportButton } from "@/components/shared/export-button";
import { SalesMyLeadsPageContent } from "@/components/sales/sales-my-leads-page-content";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { leadService } from "@/services/lead.service";
import { parseListQuery, toSearchParams } from "@/lib/query-builder";
import { settingsService } from "@/services/settings.service";
import { can, Permission } from "@/lib/permissions";
import type { TableQueryState } from "@/hooks/use-table-query";

export default async function SalesMyLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession("SALES");
  const resolvedSearchParams = await searchParams;
  const defaultPageSize = (await settingsService.get<number>("default_page_size")) ?? 25;
  const query = parseListQuery(toSearchParams(resolvedSearchParams), { defaultPageSize });
  const autoOpenLeadId = (resolvedSearchParams.leadId as string) || null;

  const canDelete = can(user, Permission.DELETE_LEAD);
  const canArchive = can(user, Permission.ARCHIVE_LEAD);
  const canExport = can(user, Permission.EXPORT_LEADS);
  const canCreate = can(user, Permission.CREATE_LEAD);

  const [result, leadSources] = await Promise.all([
    leadService.listPage(query, user),
    prisma.leadSource.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const leads = result.data;

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

  return (
    <>
      <Navbar
        title="My Leads"
        showResync
        actions={
          <>
            {canExport && <ExportButton type="leads" iconOnly />}
            <SignOutButton />
          </>
        }
      />
      <SalesMyLeadsPageContent
        leads={leads}
        initial={tableInitial}
        pagination={result.pagination}
        leadSources={leadSources}
        autoOpenLeadId={autoOpenLeadId}
        user={user}
        canDelete={canDelete}
        canArchive={canArchive}
        canCreate={canCreate}
      />
    </>
  );
}
