export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type NormalizedLead = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  product?: string;
  requirement?: string;
  sourceId?: string;
  sourceReferenceId?: string;
  assignedUserId?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  customFields?: Record<string, unknown>;
};
