type LeadDetail = Record<string, unknown> & {
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  website: string | null;
  jobTitle: string | null;
  budget: unknown;
  expectedValue: unknown;
  currency: string | null;
  campaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  product: string | null;
  requirement: string | null;
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") return String(val);
  if (typeof val === "object" && "toString" in (val as object)) {
    const str = (val as object).toString();
    return str === "[object Object]" ? JSON.stringify(val) : str;
  }
  return String(val);
}

export function LeadInfoSection({ lead }: { lead: LeadDetail }) {
  const fields: Array<{ label: string; value: unknown }> = [
    { label: "Name", value: lead.displayName },
    { label: "Company", value: lead.company },
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone },
    { label: "Alternate Phone", value: lead.alternatePhone },
    { label: "Address", value: lead.address },
    { label: "City", value: lead.city },
    { label: "State", value: lead.state },
    { label: "Country", value: lead.country },
    { label: "Industry", value: lead.industry },
    { label: "Website", value: lead.website },
    { label: "Job Title", value: lead.jobTitle },
    { label: "Product", value: lead.product },
    { label: "Requirement", value: lead.requirement },
    { label: "Budget", value: lead.budget },
    { label: "Expected Value", value: lead.expectedValue },
    { label: "Currency", value: lead.currency },
    { label: "Campaign", value: lead.campaign },
    { label: "UTM Source", value: lead.utmSource },
    { label: "UTM Medium", value: lead.utmMedium },
    { label: "UTM Campaign", value: lead.utmCampaign },
    { label: "UTM Content", value: lead.utmContent },
    { label: "UTM Term", value: lead.utmTerm },
  ];

  const visibleFields = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-[var(--color-border)]">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">General Information</h4>
      </div>
      {visibleFields.length === 0 ? (
        <div className="p-4 text-sm text-[var(--color-muted)]">No information available.</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] text-sm">
          {visibleFields.map((field) => (
            <div key={field.label} className="grid grid-cols-3 gap-2 px-4 py-2">
              <span className="text-[var(--color-muted)] truncate">{field.label}</span>
              <span className="col-span-2 font-medium break-words">{formatValue(field.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
