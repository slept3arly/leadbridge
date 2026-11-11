/**
 * Logical Enter-key order for the Create Lead form.
 *
 * The form renders two columns, so DOM order is not used as the navigation
 * contract. The list follows the visual reading order: left column first,
 * then the right column, then the footer submit action.
 */
export const CREATE_LEAD_FIELD_ORDER: readonly string[] = [
  "lead-name",
  "lead-company",
  "lead-city",
  "lead-district",
  "lead-state",
  "lead-phone",
  "lead-email",
  "lead-category",
  "lead-source",
  "lead-assigned",
  "initial-activity-action",
  "initial-activity-response",
  "lead-status",
  "lead-priority",
  "initial-activity-interest",
  "initial-activity-notes",
  "initial-activity-schedule-toggle",
  "initial-activity-follow-up-date",
  "initial-activity-follow-up-time",
  "create-lead-submit",
];

const SINGLE_LINE_INPUT_TYPES = new Set([
  "text",
  "email",
  "tel",
  "date",
  "time",
  "search",
  "url",
  "number",
  "password",
]);

/** Only single-line inputs participate in Enter-key field navigation. */
export function isEnterNavigationInput(element: { tagName: string; type?: string }) {
  if (element.tagName !== "INPUT") return false;
  return SINGLE_LINE_INPUT_TYPES.has((element.type ?? "text").toLowerCase());
}

/**
 * Custom select controls keep their own picker keyboard behavior. Enter
 * navigates only after a selection has been committed and the menu is closed.
 */
export function shouldAdvanceFromSelect(isPickerOpen: boolean, hasCommittedSelection: boolean) {
  return !isPickerOpen && hasCommittedSelection;
}

/**
 * Returns the next available field in the logical Create Lead order.
 * `isAvailable` lets the caller skip conditional, disabled, hidden, or inert fields.
 */
export function findNextCreateLeadFieldId(
  currentId: string,
  isAvailable: (id: string) => boolean = () => true,
): string | null {
  const index = CREATE_LEAD_FIELD_ORDER.indexOf(currentId);
  if (index === -1) return null;

  for (let position = index + 1; position < CREATE_LEAD_FIELD_ORDER.length; position += 1) {
    const id = CREATE_LEAD_FIELD_ORDER[position]!;
    if (isAvailable(id)) return id;
  }

  return null;
}
