/** UI-only fallback for lead identity; never use this value for persistence or API data. */
export function getLeadDisplayName(name: string | null | undefined): string {
  return name?.trim() || "Unnamed Lead";
}
