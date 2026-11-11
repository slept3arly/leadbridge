export const LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
  { value: "SPAM", label: "Junk" },
  { value: "ON_HOLD", label: "Paused" },
  { value: "OLD", label: "Old" },
] as const;

export const LEAD_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
  { value: "COLD", label: "Cold" },
] as const;

export const LEAD_CATEGORIES = [
  { value: "MEDICAL_REPRESENTATIVE", label: "Medical Representative" },
  { value: "RETAILER", label: "Retailer" },
  { value: "WHOLESALER", label: "Wholesaler" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "MARKETING", label: "Marketing" },
  { value: "THIRD_PARTY", label: "Third Party" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "FRANCHISE", label: "Franchise" },
  { value: "BUSINESS", label: "Business" },
  { value: "HOSPITAL", label: "Hospital" },
  { value: "CLINIC", label: "Clinic" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "LABORATORY", label: "Laboratory" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTHER", label: "Other" },
] as const;

export const STATUS_VALUES = LEAD_STATUSES.map((s) => s.value);
export const PRIORITY_VALUES = LEAD_PRIORITIES.map((p) => p.value);
export const CATEGORY_VALUES = LEAD_CATEGORIES.map((c) => c.value);

export function getStatusLabel(value: string): string {
  return LEAD_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function getPriorityLabel(value: string): string {
  return LEAD_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

export function getCategoryLabel(value: string): string {
  return LEAD_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const FOLLOW_UP_STATUSES = [
  { value: "PENDING", label: "To do" },
  { value: "COMPLETED", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const FOLLOW_UP_PRIORITIES = LEAD_PRIORITIES;
