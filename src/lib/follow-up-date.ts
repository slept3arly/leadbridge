/**
 * Follow-up due dates are persisted as UTC instants. The application has no
 * configured business timezone, so date-only inputs use the established server
 * convention of UTC midnight. Date-times must carry an explicit offset; callers
 * that collect local date/time values should send the resulting ISO instant.
 */
export function parseFollowUpDate(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid follow-up date.");
    return value;
  }

  const normalized = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const datePart = normalized.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) throw new Error("Invalid follow-up date.");
  const calendarDate = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== datePart) {
    throw new Error("Invalid follow-up date.");
  }
  if (!dateOnly && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) {
    throw new Error("Enter an ISO date-time with a timezone offset.");
  }
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  if (!dateOnly && !hasOffset) throw new Error("Follow-up date-time must include a timezone offset.");

  const parsed = new Date(dateOnly ? `${normalized}T00:00:00.000Z` : normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid follow-up date.");
  return parsed;
}

export function isValidFollowUpDate(value: string): boolean {
  try {
    parseFollowUpDate(value);
    return true;
  } catch {
    return false;
  }
}
