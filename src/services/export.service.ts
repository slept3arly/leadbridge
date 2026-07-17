import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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
    if (params.status?.length) where.status = { in: params.status as ("NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST")[] };
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
}

export const exportService = new ExportService();
