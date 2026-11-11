export const ACTIVITY_ACTION_OPTIONS = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;
export const ACTIVITY_ACTION_LABELS = Object.fromEntries(
  ACTIVITY_ACTION_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<(typeof ACTIVITY_ACTION_OPTIONS)[number]["value"], string>;

export const ACTIVITY_RESPONSE_OPTIONS = [
  { value: "PICKED_UP", label: "Picked up" },
  { value: "NOT_PICKED_UP", label: "Not picked up" },
  { value: "INVALID_NUMBER", label: "Invalid number" },
  { value: "SWITCHED_OFF", label: "Switched off" },
  { value: "REPLIED", label: "Replied" },
  { value: "NOT_REPLIED", label: "Not replied" },
] as const;
export const LEGACY_ACTIVITY_RESPONSE_OPTIONS = [
  { value: "NO_RESPONSE", label: "No response" },
] as const;

export const ACTIVITY_INTEREST_OPTIONS = [
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not interested" },
] as const;
export const ACTIVITY_INTEREST_LABELS = Object.fromEntries(
  ACTIVITY_INTEREST_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<(typeof ACTIVITY_INTEREST_OPTIONS)[number]["value"], string>;

export const ACTIVITY_RESPONSE_LABELS = Object.fromEntries(
  [...ACTIVITY_RESPONSE_OPTIONS, ...LEGACY_ACTIVITY_RESPONSE_OPTIONS].map(({ value, label }) => [value, label]),
) as Record<string, string>;

export function getActivityResponseLabel(value: string): string {
  return ACTIVITY_RESPONSE_LABELS[value as keyof typeof ACTIVITY_RESPONSE_LABELS]
    ?? LEGACY_ACTIVITY_RESPONSE_OPTIONS.find((option) => option.value === value)?.label
    ?? value;
}

export function getActivityInterestLabel(value: string): string {
  return ACTIVITY_INTEREST_LABELS[value as keyof typeof ACTIVITY_INTEREST_LABELS] ?? value;
}

export function getActivityResponseOptions(action: string) {
  const allowed = action === "CALL"
    ? new Set(["PICKED_UP", "NOT_PICKED_UP", "INVALID_NUMBER", "SWITCHED_OFF"])
    : new Set(["REPLIED", "NOT_REPLIED"]);
  return ACTIVITY_RESPONSE_OPTIONS.filter(({ value }) => allowed.has(value));
}

export function isSuccessfulActivityResponse(response: string) {
  return response === "PICKED_UP" || response === "REPLIED";
}
