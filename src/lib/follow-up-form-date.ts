import { parseFollowUpDate } from "@/lib/follow-up-date";

/** Convert local date/time inputs to the API's documented date representation. */
export function followUpFormDate(date: string, time: string): string | null {
  if (!date) return null;
  try { parseFollowUpDate(date); } catch { return null; }
  if (!time) return date; // Date-only values are interpreted as UTC midnight by the API.

  const localDateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(localDateTime.getTime())) return null;
  return localDateTime.toISOString();
}
