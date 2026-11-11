import { STATUS_VALUES } from "@/lib/lead-constants";

export type LeadStatus = (typeof STATUS_VALUES)[number];
export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "COLD";

export type NormalizedLead = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  product?: string;
  requirement?: string;
  sourceId?: string;
  sourceReferenceId?: string;
  connectorId?: string;
  assignedUserId?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  customFields?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  sourceType?: string;
  parserVersion?: string;
  receivedAt?: Date;
  importedAt?: Date;
};
