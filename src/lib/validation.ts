import { z } from "zod";
import { STATUS_VALUES, PRIORITY_VALUES, CATEGORY_VALUES } from "@/lib/lead-constants";
import { getActivityResponseOptions, isSuccessfulActivityResponse } from "@/lib/activity-options";
import { isValidFollowUpDate } from "@/lib/follow-up-date";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalLocationString = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value,
  z.string().max(80).nullable().optional(),
);

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : value;

export const leadEmailSchema = z.preprocess(
  normalizeOptionalString,
  z.email({ error: "Enter a valid email address." }).nullable().optional(),
);

export const leadPhoneSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.union([
    z.string().regex(/^\d{10}$/, "Enter exactly 10 digits using numbers only."),
    z.null(),
    z.undefined(),
  ]),
);

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

const normalizedNoteFollowUpDateSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : value,
  z.union([
    z.iso.date({ error: "Enter a valid follow-up date." })
      .transform((date) => new Date(`${date}T00:00:00.000Z`)),
    z.iso.datetime({ offset: true, error: "Enter a valid follow-up date." })
      .transform((date) => new Date(date)),
    z.null(),
    z.undefined(),
  ], { error: "Enter a valid follow-up date." }),
);

export const createNoteSchema = noteSchema.extend({
  followUpDate: normalizedNoteFollowUpDateSchema,
}).superRefine((data, ctx) => {
  if (data.scheduleFollowUp && !data.followUpDate) {
    ctx.addIssue({
      code: "custom",
      path: ["followUpDate"],
      message: "Follow-up date is required when scheduling a follow-up.",
    });
  }
});

const leadFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: optionalString(120),
  email: leadEmailSchema,
  phone: leadPhoneSchema,
  alternatePhone: optionalString(30),
  address: optionalString(180),
  city: optionalLocationString,
  district: optionalLocationString,
  state: optionalString(80),
  country: optionalString(80),
  // Retained as an optional compatibility input for older API clients; manual lead forms omit it.
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
  connectorId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  status: leadStatusSchema.optional(),
  priority: leadPrioritySchema.optional(),
  category: leadCategorySchema.optional().nullable(),
  isArchived: z.boolean().optional(),
});

export const leadSchema = leadFieldsSchema;
export const leadPatchSchema = leadFieldsSchema.partial();

const interactionActivityFields = {
  action: z.enum(["CALL", "WHATSAPP"]),
  response: z.enum(["PICKED_UP", "NOT_PICKED_UP", "INVALID_NUMBER", "SWITCHED_OFF", "REPLIED", "NOT_REPLIED"]),
  interest: z.enum(["INTERESTED", "NOT_INTERESTED"]).nullable(),
  notes: z.string().trim().max(10000).nullable().optional().transform((value) => value || null),
  scheduleFollowUp: z.boolean().optional().default(false),
  followUpDate: z.string().trim().nullable().optional().refine((value) => !value || isValidFollowUpDate(value), "Enter a valid follow-up date; date-times must include a timezone offset."),
  followUpTime: z.string().trim().max(10).nullable().optional().transform((value) => value || null),
};

function refineInteraction<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const action = data.action as string;
    const response = data.response as string;
    const interest = data.interest as string | null;
    const scheduleFollowUp = data.scheduleFollowUp as boolean | undefined;
    const followUpDate = data.followUpDate as string | null | undefined;
    const followUpTime = data.followUpTime as string | null | undefined;
    const responseValid = getActivityResponseOptions(action).some((option) => option.value === response);
    const interestValid = isSuccessfulActivityResponse(response) ? interest !== null : interest === null;

    if (!responseValid) {
      ctx.addIssue({ code: "custom", path: ["response"], message: "Response is not valid for this action." });
    }
    if (!interestValid) {
      ctx.addIssue({ code: "custom", path: ["interest"], message: "Interest is required only for a successful response." });
    }
    if (scheduleFollowUp && !followUpDate) {
      ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Follow-up date is required when scheduling a follow-up." });
    }
    if (!scheduleFollowUp && (followUpDate || followUpTime)) {
      ctx.addIssue({ code: "custom", path: ["scheduleFollowUp"], message: "Enable follow-up scheduling before submitting a date or time." });
    }
    if (followUpTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(followUpTime)) {
      ctx.addIssue({ code: "custom", path: ["followUpTime"], message: "Enter a valid follow-up time." });
    }
  });
}

/** Structured interaction payload shared by manual lead creation, Record Progress, and activity editing validation. */
export const interactionActivitySchema = refineInteraction(z.object(interactionActivityFields));

export const leadProgressRequestSchema = refineInteraction(z.object({
  ...interactionActivityFields,
  status: leadStatusSchema.optional(),
  priority: leadPrioritySchema.optional(),
  category: leadCategorySchema.optional().nullable(),
  requirement: optionalString(2000),
  completeFollowUpId: z.string().trim().min(1).optional(),
}));

type ActivityOutcomePatch = {
  action?: unknown;
  response?: unknown;
  interest?: unknown;
};

/** Validate an interaction PATCH against its complete resulting outcome state. */
export function validateActivityOutcomePatch(
  stored: { action: unknown; response: unknown; interest: unknown },
  patch: ActivityOutcomePatch,
) {
  const changesOutcome = patch.action !== undefined || patch.response !== undefined || patch.interest !== undefined;
  if (!changesOutcome) return null;

  const response = patch.response ?? stored.response;
  if (response === "NO_RESPONSE") {
    if (patch.action !== undefined && patch.action !== stored.action) {
      return interactionActivitySchema.safeParse({ action: patch.action, response, interest: patch.interest ?? stored.interest, notes: null, scheduleFollowUp: false });
    }
    if (patch.interest === undefined || patch.interest === null) return { success: true as const };
    return interactionActivitySchema.safeParse({ action: "CALL", response: "NOT_PICKED_UP", interest: patch.interest, notes: null, scheduleFollowUp: false });
  }

  return interactionActivitySchema.safeParse({
    action: patch.action ?? stored.action,
    response,
    interest: patch.interest !== undefined ? patch.interest : stored.interest,
    notes: null,
    scheduleFollowUp: false,
    followUpDate: null,
    followUpTime: null,
  });
}

const manualLeadBaseSchema = leadFieldsSchema.omit({ nextFollowUpAt: true });
export const manualLeadFieldsSchema = manualLeadBaseSchema;
export const manualLeadPatchSchema = manualLeadBaseSchema.partial();

export const createLeadRequestSchema = leadFieldsSchema.omit({ nextFollowUpAt: true }).extend({
  initialActivity: interactionActivitySchema,
}).superRefine((data, ctx) => {
  if (!data.email && !data.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Provide an email address or phone number." });
  }
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "SALES"]),
  salesPrivilege: z.enum(["JUNIOR", "SENIOR"]).optional().nullable(),
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

export const routingRuleUpdateSchema = routingRuleSchema.partial();

export const unmatchedActionSchema = z.object({
  action: z.enum(["ASSIGN", "CREATE_PROVIDER", "IGNORE", "SPAM", "REQUEST_PARSER"]),
  providerId: z.string().optional(),
  vendorName: z.string().optional(),
  developerNotes: z.string().max(2000).optional(),
});

const restAuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE") }),
  z.object({
    type: z.literal("API_KEY"),
    apiKey: z.object({
      name: z.string().min(1),
      value: z.string().min(1).optional(),
      in: z.enum(["header", "query"]),
    }),
  }),
  z.object({
    type: z.literal("BEARER"),
    bearerToken: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("BASIC"),
    basic: z.object({
      username: z.string().min(1),
      password: z.string().min(1).optional(),
    }),
  }),
  z.object({
    type: z.literal("CUSTOM_HEADER"),
    customHeader: z.object({
      name: z.string().min(1),
      value: z.string().min(1).optional(),
    }),
  }),
]);

const paginationConfigSchema = z.object({
  strategy: z.enum(["PAGE_NUMBER", "OFFSET", "CURSOR", "NEXT_URL", "TOKEN"]),
  pageSize: z.number().int().min(1).max(500).optional(),
  pageParam: z.string().optional(),
  perPageParam: z.string().optional(),
  offsetParam: z.string().optional(),
  limitParam: z.string().optional(),
  cursorParam: z.string().optional(),
  cursorPath: z.string().optional(),
  nextUrlPath: z.string().optional(),
  tokenParam: z.string().optional(),
  tokenPath: z.string().optional(),
  maxPages: z.number().int().min(1).max(100).optional(),
}).superRefine((config, context) => {
  const requiredPath = config.strategy === "CURSOR" ? config.cursorPath
    : config.strategy === "NEXT_URL" ? config.nextUrlPath
    : config.strategy === "TOKEN" ? config.tokenPath
    : undefined;
  if (requiredPath !== undefined && requiredPath.trim()) return;
  if (["CURSOR", "NEXT_URL", "TOKEN"].includes(config.strategy)) {
    const path = config.strategy === "CURSOR" ? "cursorPath" : config.strategy === "NEXT_URL" ? "nextUrlPath" : "tokenPath";
    context.addIssue({ code: "custom", path: [path], message: `${path} is required for ${config.strategy} pagination.` });
  }
}).optional();

export const restConnectorConfigSchema = z.object({
  baseUrl: z.string().url("Must be a valid URL").superRefine((value, context) => {
    let url: URL;
    try { url = new URL(value); } catch { return; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      context.addIssue({ code: "custom", message: "Base URL must use HTTP(S) and cannot contain credentials, query parameters, or a fragment." });
    }
  }),
  endpoint: z.string().trim().min(1, "Endpoint is required").refine((value) => !/[?#]/.test(value) && !/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !value.startsWith("//"), {
    message: "Endpoint must be a relative path; configure query parameters separately.",
  }),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.string().max(1_048_576).optional().refine((body) => {
    if (!body?.trim()) return true;
    try { JSON.parse(body); return true; } catch { return false; }
  }, "Request body must contain valid JSON."),
  auth: restAuthConfigSchema.optional(),
  pagination: paginationConfigSchema,
  leadArrayPath: z.string().optional(),
  timeout: z.number().int().min(100).max(30000).optional(),
  retryCount: z.number().int().min(0).max(3).optional(),
  rateLimitDelayMs: z.number().int().min(0).max(10000).optional(),
});

export const followUpUpdateSchema = followUpSchema.omit({ leadId: true }).partial().strict();
