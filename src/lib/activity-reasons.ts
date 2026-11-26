export const ACTIVITY_REASON_OPTIONS = [
  { value: "LANGUAGE_BARRIER", label: "Language barrier" },
  { value: "SELECTED_BY_MISTAKE", label: "Selected by mistake" },
  { value: "PERSONAL_USE", label: "Personal use" },
  { value: "SEEKING_EMPLOYMENT", label: "Seeking employment" },
  { value: "NOT_IN_MEDICAL_PHARMACEUTICAL_BUSINESS", label: "Not in the medical/pharmaceutical business" },
  { value: "THIRD_PARTY_PRODUCTS_OR_SERVICES", label: "Looking for third-party products or services" },
  { value: "NEAR_EXPIRY_PRODUCTS", label: "Interested in near-expiry products" },
  { value: "ECOMMERCE_ONLINE_DIRECT_SELLING_MLM", label: "E-commerce, online sales, direct selling or MLM" },
  { value: "CREDIT_OR_DEFERRED_PAYMENT", label: "Seeking credit / deferred payment" },
  { value: "ALLOPATHIC_PRODUCTS", label: "Interested in allopathic products" },
  { value: "NO_CURRENT_REQUIREMENT", label: "No current requirement" },
  { value: "COSMETIC_PRODUCTS_AND_TREATMENTS", label: "Cosmetic Products & Treatments" },
  { value: "TRADITIONAL_CLASSICAL_HEALTHCARE_PRODUCTS", label: "Traditional / Classical Healthcare Products" },
  { value: "NUTRACEUTICALS_AND_DIETARY_SUPPLEMENTS", label: "Nutraceuticals & Dietary Supplements" },
  { value: "CALL_CUT_HOLD", label: "Call cut/Hold" },
] as const;

export const ACTIVITY_REASON_VALUES = ACTIVITY_REASON_OPTIONS.map((option) => option.value);

export function getActivityReasonLabel(value: string): string {
  return ACTIVITY_REASON_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
