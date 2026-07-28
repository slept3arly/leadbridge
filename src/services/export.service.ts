import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { STATUS_VALUES } from "@/lib/lead-constants";
import { reportService } from "@/services/report.service";
import { auditService } from "@/services/audit.service";

function escapeCsv(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(",") + "\n";
}

async function exportInChunks<T>(
  fetchChunk: (skip: number, take: number) => Promise<T[]>,
  toRow: (item: T) => string,
  header: string[],
  batchSize = 1000,
) {
  const chunks: string[] = [toCsvRow(header)];
  let skip = 0;

  while (true) {
    const rows = await fetchChunk(skip, batchSize);
    if (rows.length === 0) break;
    for (const row of rows) {
      chunks.push(toRow(row));
    }
    skip += rows.length;
    if (rows.length < batchSize) break;
  }

  return chunks.join("");
}

export class ExportService {
  async exportLeads(params: {
    status?: string[];
    assignedUserId?: string;
    from?: Date;
    to?: Date;
    search?: string;
  }): Promise<string> {
    const where: Prisma.LeadWhereInput = { isDeleted: false };
    if (params.status?.length) where.status = { in: params.status.filter((status) => STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) as (typeof STATUS_VALUES)[number][] };
    if (params.assignedUserId) where.assignedUserId = params.assignedUserId;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }
    if (params.search) {
      where.OR = [
        { displayName: { contains: params.search, mode: "insensitive" } },
        { company: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { leadNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    return exportInChunks(
      (skip, take) => prisma.lead.findMany({
        where,
        select: {
          leadNumber: true,
          displayName: true,
          company: true,
          email: true,
          phone: true,
          status: true,
          priority: true,
          city: true,
          state: true,
          country: true,
          product: true,
          requirement: true,
          createdAt: true,
          assignedUser: { select: { name: true } },
          source: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      (lead) => toCsvRow([lead.leadNumber, lead.displayName, lead.company, lead.email, lead.phone, lead.status, lead.priority, lead.city, lead.state, lead.country, lead.product, lead.requirement, lead.createdAt.toISOString(), lead.assignedUser?.name ?? "", lead.source?.name ?? ""]),
      ["Lead Number", "Name", "Company", "Email", "Phone", "Status", "Priority", "City", "State", "Country", "Product", "Requirement", "Created At", "Assigned To", "Source"],
    );
  }

  async exportUsers(): Promise<string> {
    return exportInChunks(
      (skip, take) => prisma.user.findMany({
        where: { isDeleted: false },
        select: { name: true, email: true, role: true, active: true, employeeCode: true, designation: true, phone: true, createdAt: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take,
      }),
      (user) => toCsvRow([user.name, user.email, user.role, user.active ? "Yes" : "No", user.employeeCode ?? "", user.designation ?? "", user.phone ?? "", user.createdAt.toISOString()]),
      ["Name", "Email", "Role", "Active", "Employee Code", "Designation", "Phone", "Created At"],
    );
  }

  async exportProviders(): Promise<string> {
    return exportInChunks(
      (skip, take) => prisma.leadSource.findMany({
        where: { active: true },
        select: { name: true, slug: true, sourceType: true, active: true, createdAt: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take,
      }),
      (provider) => toCsvRow([provider.name, provider.slug, provider.sourceType, provider.active ? "Yes" : "No", provider.createdAt.toISOString()]),
      ["Name", "Slug", "Type", "Active", "Created At"],
    );
  }

  async exportSyncHistory(params?: {
    from?: Date;
    to?: Date;
    connectorId?: string;
  }): Promise<string> {
    const where: Prisma.ConnectorSyncRunWhereInput = {};
    if (params?.connectorId) where.connectorId = params.connectorId;
    if (params?.from || params?.to) {
      where.startedAt = {};
      if (params.from) where.startedAt.gte = params.from;
      if (params.to) where.startedAt.lte = params.to;
    }

    return exportInChunks(
      (skip, take) => prisma.connectorSyncRun.findMany({
        where,
        select: {
          id: true,
          connector: { select: { name: true, type: true } },
          status: true,
          startedAt: true,
          completedAt: true,
          recordsSeen: true,
          recordsCreated: true,
          recordsUpdated: true,
          recordsSkipped: true,
          errorMessage: true,
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      (run) => toCsvRow([run.id, run.connector.name, run.connector.type, run.status, run.startedAt.toISOString(), run.completedAt?.toISOString() ?? "", run.recordsSeen, run.recordsCreated, run.recordsUpdated, run.recordsSkipped, run.errorMessage ?? ""]),
      ["Run ID", "Connector", "Type", "Status", "Started At", "Completed At", "Records Seen", "Created", "Updated", "Skipped", "Error"],
    );
  }
  async exportReports(params?: { from?: Date; to?: Date }): Promise<string> {
    const range = params?.from && params?.to ? { from: params.from, to: params.to } : undefined;
    const dateLabel = range ? `${params!.from!.toISOString().split("T")[0]} to ${params!.to!.toISOString().split("T")[0]}` : "All time";

    const [summary, sources, assignments, statusBreakdown, trends, activity] = await Promise.all([
      reportService.leadSummary(range),
      reportService.leadSources(range),
      reportService.assignments(range),
      reportService.statusBreakdown(range),
      reportService.monthlyTrends(),
      reportService.activity(),
    ]);

    const rows: string[] = [];

    rows.push(toCsvRow(["LeadBridge Report", dateLabel, "", "", ""]));
    rows.push("");

    rows.push(toCsvRow(["Metric", "Value", "", "", ""]));
    rows.push(toCsvRow(["Total Leads", summary.total, "", "", ""]));
    rows.push(toCsvRow(["Active", summary.active, "", "", ""]));
    rows.push(toCsvRow(["Won", summary.won, "", "", ""]));
    rows.push(toCsvRow(["Lost", summary.lost, "", "", ""]));
    rows.push(toCsvRow(["Conversion Rate", `${summary.conversionRate}%`, "", "", ""]));
    rows.push(toCsvRow(["Open Rate", `${summary.openRate}%`, "", "", ""]));
    rows.push("");

    rows.push(toCsvRow(["Lead Status", "Count", "", "", ""]));
    for (const s of statusBreakdown) {
      rows.push(toCsvRow([s.status, s.count, "", "", ""]));
    }
    rows.push("");

    rows.push(toCsvRow(["Lead Source", "Leads", "", "", ""]));
    for (const s of sources.byProvider) {
      rows.push(toCsvRow([s.providerName, s.count, "", "", ""]));
    }
    rows.push("");

    rows.push(toCsvRow(["Salesperson", "Assigned Leads", "", "", ""]));
    for (const a of assignments.bySalesperson) {
      rows.push(toCsvRow([a.userName, a.leadCount, "", "", ""]));
    }
    rows.push(toCsvRow(["Unassigned", assignments.unassigned, "", "", ""]));
    rows.push("");

    rows.push(toCsvRow(["Month", "Created", "Won", "Lost", ""]));
    for (const t of trends) {
      rows.push(toCsvRow([t.month, t.total, t.won, t.lost, ""]));
    }
    rows.push("");

    rows.push(toCsvRow(["Activity", "Count", "", "", ""]));
    rows.push(toCsvRow(["Today", activity.today, "", "", ""]));
    rows.push(toCsvRow(["This Week", activity.thisWeek, "", "", ""]));
    rows.push(toCsvRow(["This Month", activity.thisMonth, "", "", ""]));

    return rows.join("");
  }

  async exportAuditLogs(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string> {
    const readableAction = (action: string, entityType: string): string => {
      const entity: Record<string, string> = {
        Lead: "lead", Note: "note", LeadSource: "provider", Connector: "connector",
        User: "user", RoutingRule: "routing rule", UnmatchedEmail: "unmatched email",
        ParserRequest: "parser request", Contact: "contact",
      };
      const noun = entity[entityType] ?? entityType.toLowerCase().replace(/_/g, " ");
      if (action.endsWith(".created")) return `created ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
      if (action.endsWith(".updated")) return `updated ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
      if (action.endsWith(".deleted")) return `deleted ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
      if (action.endsWith(".restored")) return `restored ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
      if (action.endsWith(".assigned")) return `assigned ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
      if (action === "connector.sync_completed") return `completed a sync for ${noun}`;
      const verbMatch = action.match(/\.(\w+)$/);
      const verb = verbMatch ? verbMatch[1].replace(/_/g, " ") : action;
      return `${verb} ${noun}`;
    };

    const describeMetadata = (meta: unknown): string => {
      if (!meta || typeof meta !== "object") return "";
      return Object.entries(meta as Record<string, unknown>)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
    };

    const rows: string[] = [toCsvRow(["Timestamp", "Activity", "Entity", "Description", "Performed By"])];

    const result = await auditService.listPage({
      ...params,
      page: 1,
      pageSize: 1000,
    });

    for (const entry of result.data) {
      const timestamp = new Date(entry.createdAt).toISOString();
      const activity = readableAction(entry.action, entry.entityType);
      const entity = entry.entityType;
      const description = describeMetadata(entry.metadata);
      const actor = entry.actor?.name ?? "System";
      rows.push(toCsvRow([timestamp, activity, entity, description, actor]));
    }

    return rows.join("");
  }
}

export const exportService = new ExportService();
