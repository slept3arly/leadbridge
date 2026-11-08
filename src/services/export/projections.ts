import type { Prisma } from "@/generated/prisma/client";
import { resolveExportColumns } from "@/lib/export/fields";
export { LEGACY_EXPORT_COLUMNS } from "@/lib/export/legacy-contract";

function selected(columns: readonly string[], id: string): boolean {
  return columns.includes(id);
}

export function resolveLeadProjection(requested?: readonly string[]): { columns: string[]; select: Prisma.LeadSelect } {
  const columns = resolveExportColumns("leads", requested);
  const has = (id: string) => selected(columns, id);
  const select = {
    id: true,
    ...(has("leadNumber") ? { leadNumber: true } : {}),
    ...(has("name") ? { displayName: true } : {}),
    ...(has("company") ? { company: true } : {}),
    ...(has("email") ? { email: true } : {}),
    ...(has("phone") ? { phone: true } : {}),
    ...(has("alternatePhone") ? { alternatePhone: true } : {}),
    ...(has("status") ? { status: true } : {}),
    ...(has("priority") ? { priority: true } : {}),
    ...(has("category") ? { category: true } : {}),
    ...(has("city") ? { city: true } : {}),
    ...(has("state") ? { state: true } : {}),
    ...(has("country") ? { country: true } : {}),
    ...(has("requirement") ? { requirement: true } : {}),
    createdAt: true,
    ...(has("assignedTo") ? { assignedUser: { select: { name: true } } } : {}),
    ...(has("source") ? { source: { select: { name: true } } } : {}),
    ...(has("firstContactedAt") ? { firstContactedAt: true } : {}),
    ...(has("lastContactedAt") ? { lastContactedAt: true } : {}),
    ...(has("nextFollowUpAt") ? { nextFollowUpAt: true } : {}),
    ...(has("lastFollowUpAt") ? { lastFollowUpAt: true } : {}),
    ...(has("closedAt") ? { closedAt: true } : {}),
    ...(has("convertedAt") ? { convertedAt: true } : {}),
    ...(has("isArchived") ? { isArchived: true } : {}),
    ...(has("product") ? { product: true } : {}),
    ...(has("industry") ? { industry: true } : {}),
    ...(has("website") ? { website: true } : {}),
    ...(has("jobTitle") ? { jobTitle: true } : {}),
    ...(has("address") ? { address: true } : {}),
    ...(has("budget") ? { budget: true } : {}),
    ...(has("expectedValue") ? { expectedValue: true } : {}),
    ...(has("currency") ? { currency: true } : {}),
    ...(has("lostReason") ? { lostReason: true } : {}),
    ...(has("campaign") ? { campaign: true } : {}),
    ...(has("campaignId") ? { campaignId: true } : {}),
    ...(has("utmSource") ? { utmSource: true } : {}),
    ...(has("utmMedium") ? { utmMedium: true } : {}),
    ...(has("utmCampaign") ? { utmCampaign: true } : {}),
    ...(has("utmContent") ? { utmContent: true } : {}),
    ...(has("utmTerm") ? { utmTerm: true } : {}),
  } satisfies Prisma.LeadSelect;
  return { columns, select };
}

export function resolveUserProjection(requested?: readonly string[]): { columns: string[]; select: Prisma.UserSelect } {
  const columns = resolveExportColumns("users", requested);
  const has = (id: string) => selected(columns, id);
  const select = {
    id: true,
    name: true,
    ...(has("email") ? { email: true } : {}),
    ...(has("role") ? { role: true } : {}),
    ...(has("salesPrivilege") ? { salesPrivilege: true } : {}),
    ...(has("active") ? { active: true } : {}),
    ...(has("employeeCode") ? { employeeCode: true } : {}),
    ...(has("designation") ? { designation: true } : {}),
    ...(has("createdAt") ? { createdAt: true } : {}),
    ...(has("phone") ? { phone: true } : {}),
    ...(has("banned") ? { banned: true } : {}),
    ...(has("lastLoginAt") ? { lastLoginAt: true } : {}),
    ...(has("updatedAt") ? { updatedAt: true } : {}),
  } satisfies Prisma.UserSelect;
  return { columns, select };
}

export function resolveProviderProjection(requested?: readonly string[]): { columns: string[]; select: Prisma.LeadSourceSelect } {
  const columns = resolveExportColumns("providers", requested);
  const has = (id: string) => selected(columns, id);
  const select = {
    id: true,
    name: true,
    ...(has("slug") ? { slug: true } : {}),
    ...(has("sourceType") ? { sourceType: true } : {}),
    ...(has("active") ? { active: true } : {}),
    ...(has("createdAt") ? { createdAt: true } : {}),
    ...(has("updatedAt") ? { updatedAt: true } : {}),
  } satisfies Prisma.LeadSourceSelect;
  return { columns, select };
}

export function resolveSyncHistoryProjection(requested?: readonly string[]): { columns: string[]; select: Prisma.ConnectorSyncRunSelect } {
  const columns = resolveExportColumns("sync-history", requested);
  const has = (id: string) => selected(columns, id);
  const connectorSelection = {
    ...(has("connector") ? { name: true } : {}),
    ...(has("type") ? { type: true } : {}),
  };
  const select = {
    id: true,
    ...(has("connector") || has("type") ? { connector: { select: connectorSelection } } : {}),
    ...(has("status") ? { status: true } : {}),
    startedAt: true,
    ...(has("completedAt") ? { completedAt: true } : {}),
    ...(has("recordsSeen") ? { recordsSeen: true } : {}),
    ...(has("recordsCreated") ? { recordsCreated: true } : {}),
    ...(has("recordsUpdated") ? { recordsUpdated: true } : {}),
    ...(has("recordsSkipped") ? { recordsSkipped: true } : {}),
  } satisfies Prisma.ConnectorSyncRunSelect;
  return { columns, select };
}

