import { toCsvRow, type CsvCellKind } from "@/lib/csv";
import { EXPORT_FIELDS, getDefaultExportColumns, resolveExportColumns } from "@/lib/export/fields";
import { sanitizeSyncErrorDiagnostic } from "@/lib/sync-error";
import { ExportDeliveryError, type CsvExportRecord } from "@/services/export/csv-stream";

export function getExportCsvHeaders(category: "leads" | "users" | "providers", requested?: readonly string[]): string[] {
  const columns = resolveExportColumns(category, requested);
  const fields = EXPORT_FIELDS[category];
  return columns.map((id) => fields.find((field) => field.id === id)!.header);
}

export const EXPORT_CSV_HEADERS = {
  leads: getExportCsvHeaders("leads", getDefaultExportColumns("leads")),
  users: getExportCsvHeaders("users", getDefaultExportColumns("users")),
  providers: getExportCsvHeaders("providers", getDefaultExportColumns("providers")),
  "sync-history": ["Run ID", "Connector", "Type", "Status", "Started At", "Completed At", "Records Seen", "Created", "Updated", "Skipped", "Error"],
} as const;

function serialize(values: unknown[], kinds?: readonly CsvCellKind[]): string {
  try {
    return toCsvRow(values, kinds);
  } catch {
    throw new ExportDeliveryError("SERIALIZATION_FAILED");
  }
}

function date(value: Date | null): string {
  return value?.toISOString() ?? "";
}

function selectedRow(category: "leads" | "users" | "providers", values: Record<string, unknown>, columns: readonly string[]): string {
  const fields = EXPORT_FIELDS[category];
  const kinds: CsvCellKind[] = columns.map((id) => {
    const field = fields.find((item) => item.id === id);
    if (!field) throw new ExportDeliveryError("SERIALIZATION_FAILED");
    if (field.kind === "number") return "number";
    if (field.id === "phone" || field.id === "alternatePhone") return "phone";
    return "text";
  });
  for (const id of columns) {
    if (!Object.hasOwn(values, id)) throw new ExportDeliveryError("SERIALIZATION_FAILED");
  }
  return serialize(columns.map((id) => values[id]), kinds);
}

export function serializeLeadCsvRow(lead: {
  leadNumber: string;
  displayName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  city: string | null;
  district?: string | null;
  state: string | null;
  country: string | null;
  product: string | null;
  requirement: string | null;
  lostReason?: string | null;
  address?: string | null;
  industry?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  budget?: { toString(): string } | null;
  expectedValue?: { toString(): string } | null;
  wonAmount?: { toString(): string } | null;
  currency?: string | null;
  campaign?: string | null;
  campaignId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  firstContactedAt?: Date | null;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  lastFollowUpAt?: Date | null;
  closedAt?: Date | null;
  convertedAt?: Date | null;
  isArchived?: boolean;
  assignedUser?: { name: string } | null;
  source: { name: string } | null;
}, columns: readonly string[] = getDefaultExportColumns("leads"), serialNumber = 1): string {
  return selectedRow("leads", {
    serialNumber,
    leadNumber: lead.leadNumber,
    name: lead.displayName,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    alternatePhone: lead.alternatePhone,
    status: lead.status,
    priority: lead.priority,
    category: lead.category,
    city: lead.city,
    district: lead.district,
    state: lead.state,
    country: lead.country,
    source: lead.source?.name,
    product: lead.product,
    requirement: lead.requirement,
    lostReason: lead.lostReason,
    assignedTo: lead.assignedUser?.name,
    createdAt: date(lead.createdAt),
    updatedAt: lead.updatedAt ? date(lead.updatedAt) : "",
    firstContactedAt: date(lead.firstContactedAt ?? null),
    lastContactedAt: date(lead.lastContactedAt ?? null),
    nextFollowUpAt: date(lead.nextFollowUpAt ?? null),
    lastFollowUpAt: date(lead.lastFollowUpAt ?? null),
    closedAt: date(lead.closedAt ?? null),
    convertedAt: date(lead.convertedAt ?? null),
    isArchived: lead.isArchived === undefined ? "" : lead.isArchived ? "Yes" : "No",
    address: lead.address,
    industry: lead.industry,
    website: lead.website,
    jobTitle: lead.jobTitle,
    budget: lead.budget?.toString(),
    expectedValue: lead.expectedValue?.toString(),
    wonAmount: lead.wonAmount?.toString(),
    currency: lead.currency,
    campaign: lead.campaign,
    campaignId: lead.campaignId,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    utmContent: lead.utmContent,
    utmTerm: lead.utmTerm,
  }, columns);
}

export async function* serializeLeadCsvRecords(
  rows: AsyncIterable<Parameters<typeof serializeLeadCsvRow>[0]>,
  columns: readonly string[],
): AsyncGenerator<CsvExportRecord> {
  yield { csv: serializeReportCsvRow(getExportCsvHeaders("leads", columns)), dataRows: 0 };
  let serialNumber = 0;
  for await (const lead of rows) {
    serialNumber += 1;
    yield { csv: serializeLeadCsvRow(lead, columns, serialNumber) };
  }
}

export function serializeUserCsvRow(user: {
  name: string;
  email: string;
  role: string;
  active: boolean;
  employeeCode: string | null;
  designation: string | null;
  phone: string | null;
  createdAt: Date;
  salesPrivilege?: string | null;
}, columns: readonly string[] = getDefaultExportColumns("users")): string {
  return selectedRow("users", {
    name: user.name, email: user.email, role: user.role, salesPrivilege: user.salesPrivilege,
    active: user.active ? "Yes" : "No", employeeCode: user.employeeCode, designation: user.designation,
    phone: user.phone, createdAt: date(user.createdAt),
  }, columns);
}

export function serializeProviderCsvRow(provider: {
  name: string;
  slug: string;
  sourceType: string;
  active: boolean;
  createdAt: Date;
  description?: string | null;
  priority?: number;
  updatedAt?: Date;
}, columns: readonly string[] = getDefaultExportColumns("providers")): string {
  return selectedRow("providers", {
    name: provider.name, slug: provider.slug, sourceType: provider.sourceType,
    active: provider.active ? "Yes" : "No", createdAt: date(provider.createdAt),
    description: provider.description, priority: provider.priority,
    updatedAt: provider.updatedAt ? date(provider.updatedAt) : "",
  }, columns);
}

export function serializeSyncRunCsvRow(run: {
  id: string;
  connector: { name: string; type: string };
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  recordsSeen: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage: string | null;
}): string {
  return serialize([
    run.id, run.connector.name, run.connector.type, run.status, date(run.startedAt), date(run.completedAt),
    run.recordsSeen, run.recordsCreated, run.recordsUpdated, run.recordsSkipped, sanitizeSyncErrorDiagnostic(run.errorMessage),
  ]);
}

export function serializeReportCsvRow(values: unknown[]): string {
  return serialize(values);
}

export function serializeCsvBlankLine(): string {
  return "\n";
}
