import { z } from "zod";
import { STATUS_VALUES, PRIORITY_VALUES, CATEGORY_VALUES } from "@/lib/lead-constants";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || null);

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const leadStatusSchema = z.enum(STATUS_VALUES as [string, ...string[]]);

export const leadPrioritySchema = z.enum(PRIORITY_VALUES as [string, ...string[]]);

export const leadCategorySchema = z.enum(CATEGORY_VALUES as [string, ...string[]]);

export const followUpSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  dueTime: z.string().max(10).optional().nullable(),
  priority: leadPrioritySchema.optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  assignedUserId: z.string().optional().nullable(),
  leadId: z.string().min(1),
});

export const noteSchema = z.object({
  content: z.string().trim().max(10000).optional(),
  whatIDid: z.string().trim().max(5000).optional().nullable(),
  whatCustomerSaid: z.string().trim().max(5000).optional().nullable(),
  scheduleFollowUp: z.boolean().optional(),
  followUpDate: z.string().optional().nullable(),
  followUpTime: z.string().optional().nullable(),
});

export const leadSchema = z.object({
  name: z.string().min(2).max(120),
  company: optionalString(120),
  email: z.email().optional().nullable().transform((value) => value || null),
  phone: optionalString(30),
  alternatePhone: optionalString(30),
  address: optionalString(180),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  product: optionalString(120),
  requirement: optionalString(2000),
  industry: optionalString(120),
  website: optionalString(255),
  jobTitle: optionalString(120),
  budget: z.coerce.number().nonnegative().optional().nullable(),
  expectedValue: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  campaign: optionalString(160),
  campaignId: optionalString(120),
  utmSource: optionalString(120),
  utmMedium: optionalString(120),
  utmCampaign: optionalString(120),
  utmContent: optionalString(120),
  utmTerm: optionalString(120),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  lostReason: optionalString(500),
  wonAmount: z.coerce.number().nonnegative().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
  rawPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  sourceId: z.string().optional().nullable(),
  sourceReferenceId: optionalString(120),
  assignedUserId: z.string().optional().nullable(),
  status: leadStatusSchema.optional(),
  priority: leadPrioritySchema.optional(),
  category: leadCategorySchema.optional().nullable(),
  isArchived: z.boolean().optional(),
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "SALES"]),
});

export const settingSchema = z.object({
  key: z.string().min(2).max(80),
  value: z.record(z.string(), z.unknown()),
});

export const assignmentSchema = z.object({
  assignedUserId: z.string().min(1).nullable(),
});

export const providerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  sourceType: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

export const routingRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  recipientGmailAccount: z.string().trim().max(120).optional().nullable(),
  senderEmail: z.email().optional().nullable(),
  senderDomain: z.string().trim().max(120).optional().nullable(),
  subjectContains: z.string().trim().max(250).optional().nullable(),
  gmailLabel: z.string().trim().max(120).optional().nullable(),
  priority: z.number().int().min(0).max(10000).optional(),
  fallback: z.boolean().optional(),
  active: z.boolean().optional(),
  providerId: z.string().min(1),
  parserId: z.string().min(1),
  connectorId: z.string().optional().nullable(),
});

export const unmatchedActionSchema = z.object({
  action: z.enum(["ASSIGN", "CREATE_PROVIDER", "IGNORE", "SPAM", "REQUEST_PARSER"]),
  providerId: z.string().optional(),
  vendorName: z.string().optional(),
  developerNotes: z.string().max(2000).optional(),
});
