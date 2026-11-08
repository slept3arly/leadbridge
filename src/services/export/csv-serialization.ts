import { toCsvRow } from "@/lib/csv";
import { ExportDeliveryError } from "@/services/export/csv-stream";

export const EXPORT_CSV_HEADERS = {
  leads: ["Lead Number", "Name", "Company", "Email", "Phone", "Status", "Priority", "City", "State", "Country", "Product", "Requirement", "Created At", "Assigned To", "Source"],
  users: ["Name", "Email", "Role", "Active", "Employee Code", "Designation", "Phone", "Created At"],
  providers: ["Name", "Slug", "Type", "Active", "Created At"],
  "sync-history": ["Run ID", "Connector", "Type", "Status", "Started At", "Completed At", "Records Seen", "Created", "Updated", "Skipped", "Error"],
} as const;

function serialize(values: unknown[]): string {
  try {
    return toCsvRow(values);
  } catch {
    throw new ExportDeliveryError("SERIALIZATION_FAILED");
  }
}

function date(value: Date | null): string {
  return value?.toISOString() ?? "";
}

export function serializeLeadCsvRow(lead: {
  leadNumber: string;
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  priority: string;
  city: string | null;
  state: string | null;
  country: string | null;
  product: string | null;
  requirement: string | null;
  createdAt: Date;
  assignedUser: { name: string } | null;
  source: { name: string } | null;
}): string {
  return serialize([
    lead.leadNumber, lead.displayName, lead.company, lead.email, lead.phone, lead.status, lead.priority,
    lead.city, lead.state, lead.country, lead.product, lead.requirement, date(lead.createdAt),
    lead.assignedUser?.name, lead.source?.name,
  ]);
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
}): string {
  return serialize([user.name, user.email, user.role, user.active ? "Yes" : "No", user.employeeCode, user.designation, user.phone, date(user.createdAt)]);
}

export function serializeProviderCsvRow(provider: {
  name: string;
  slug: string;
  sourceType: string;
  active: boolean;
  createdAt: Date;
}): string {
  return serialize([provider.name, provider.slug, provider.sourceType, provider.active ? "Yes" : "No", date(provider.createdAt)]);
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
}): string {
  return serialize([
    run.id, run.connector.name, run.connector.type, run.status, date(run.startedAt), date(run.completedAt),
    run.recordsSeen, run.recordsCreated, run.recordsUpdated, run.recordsSkipped, "",
  ]);
}

export function serializeReportCsvRow(values: unknown[]): string {
  return serialize(values);
}

export function serializeCsvBlankLine(): string {
  return "\n";
}
