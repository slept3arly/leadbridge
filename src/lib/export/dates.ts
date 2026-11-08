import { z } from "zod";

export const EXPORT_DATE_PRESETS = [
  "all-time",
  "today",
  "yesterday",
  "last-7-days",
  "last-30-days",
  "this-month",
  "previous-month",
  "custom",
] as const;

export const exportDatePresetSchema = z.enum(EXPORT_DATE_PRESETS);
export type ExportDatePreset = z.infer<typeof exportDatePresetSchema>;

export const EXPORT_TIME_ZONE = "UTC" as const;

const dateOnlySchema = z.iso.date();
const timestampSchema = z.iso.datetime({ offset: true });
export const exportDateInputSchema = z.union([dateOnlySchema, timestampSchema]);
export type ExportDateInput = z.infer<typeof exportDateInputSchema>;

const customDateRangeSchema = z.object({
  from: exportDateInputSchema,
  to: exportDateInputSchema,
}).strict().superRefine((range, ctx) => {
  const fromIsDateOnly = dateOnlySchema.safeParse(range.from).success;
  const toIsDateOnly = dateOnlySchema.safeParse(range.to).success;
  if (fromIsDateOnly !== toIsDateOnly) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Use date-only values for both boundaries or timestamps for both." });
    return;
  }

  const from = Date.parse(fromIsDateOnly ? `${range.from}T00:00:00.000Z` : range.from);
  const to = Date.parse(toIsDateOnly ? `${range.to}T00:00:00.000Z` : range.to);
  if ((fromIsDateOnly && to < from) || (!fromIsDateOnly && to <= from)) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "The end of the range must be after its start." });
  }
});

export const exportDateRangeSchema = z.object({
  preset: exportDatePresetSchema.default("all-time"),
  custom: customDateRangeSchema.optional(),
}).strict().superRefine((range, ctx) => {
  if (range.preset === "custom" && !range.custom) {
    ctx.addIssue({ code: "custom", path: ["custom"], message: "A custom range requires both from and to." });
  }
  if (range.preset !== "custom" && range.custom) {
    ctx.addIssue({ code: "custom", path: ["custom"], message: "Custom boundaries are valid only with the custom preset." });
  }
});

export type ExportDateRangeInput = z.infer<typeof exportDateRangeSchema>;
export type ResolvedExportDateRange = { from?: Date; toExclusive?: Date };

/** Resolves calendar presets using UTC boundaries; does not access data or build a query. */
export function resolveExportDateRange(
  input: ExportDateRangeInput,
  now: Date = new Date(),
): ResolvedExportDateRange {
  const parsed = exportDateRangeSchema.parse(input);
  if (parsed.preset === "all-time") return {};

  if (parsed.preset === "custom" && parsed.custom) {
    const dateOnly = dateOnlySchema.safeParse(parsed.custom.from).success;
    return {
      from: dateOnly
        ? new Date(`${parsed.custom.from}T00:00:00.000Z`)
        : new Date(parsed.custom.from),
      toExclusive: dateOnly
        ? addUtcDays(new Date(`${parsed.custom.to}T00:00:00.000Z`), 1)
        : new Date(parsed.custom.to),
    };
  }

  const today = utcStartOfDay(now);
  switch (parsed.preset) {
    case "today": return { from: today, toExclusive: addUtcDays(today, 1) };
    case "yesterday": return { from: addUtcDays(today, -1), toExclusive: today };
    case "last-7-days": return { from: addUtcDays(today, -6), toExclusive: addUtcDays(today, 1) };
    case "last-30-days": return { from: addUtcDays(today, -29), toExclusive: addUtcDays(today, 1) };
    case "this-month": return {
      from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      toExclusive: addUtcDays(today, 1),
    };
    case "previous-month":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
        toExclusive: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      };
    default: return {};
  }
}

function utcStartOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
