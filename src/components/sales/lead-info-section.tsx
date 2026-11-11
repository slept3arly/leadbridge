import { DateTimeDisplay } from "@/components/shared/date-time-display";

type LeadCustomer = Record<string, unknown> & {
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  website: string | null;
  jobTitle: string | null;
  budget: unknown;
  expectedValue: unknown;
  currency: string | null;
  requirement: string | null;
  campaign?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  source?: { name: string } | null;
  sourceName: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
  updatedAt: string;
  updatedBy: { name: string } | null;
  importedAt: string | null;
  firstContactedAt?: string | null;
  lastContactedAt?: string | null;
  closedAt?: string | null;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "toString" in value) {
    const text = value.toString();
    return text === "[object Object]" ? JSON.stringify(value) : text;
  }
  return String(value);
}

export function LeadInfoSection({ lead }: { lead: LeadCustomer }) {
  const fields: Array<{ label: string; value: unknown; kind?: "email" | "phone" | "website"; wide?: boolean }> = [
    { label: "Phone", value: lead.phone, kind: "phone" },
    { label: "Email", value: lead.email, kind: "email" },
    { label: "Alternate phone", value: lead.alternatePhone, kind: "phone" },
    { label: "District", value: lead.district },
    { label: "City", value: lead.city },
    { label: "State", value: lead.state },
    { label: "Country", value: lead.country },
    { label: "Address", value: lead.address, wide: true },
    { label: "Campaign", value: lead.campaign },
    { label: "UTM source", value: lead.utmSource },
    { label: "UTM medium", value: lead.utmMedium },
    { label: "UTM campaign", value: lead.utmCampaign },
    { label: "UTM content", value: lead.utmContent },
    { label: "UTM term", value: lead.utmTerm },
    { label: "Industry", value: lead.industry },
    { label: "Job title", value: lead.jobTitle },
    { label: "Website", value: lead.website, kind: "website" },
    { label: "Budget", value: lead.budget },
    { label: "Expected value", value: lead.expectedValue },
    { label: "Currency", value: lead.currency },
    { label: "Requirement", value: lead.requirement, wide: true },
    { label: "Lead source", value: lead.source?.name || lead.sourceName || (lead.importedAt ? "Imported" : "Manual entry"), wide: true },
  ];
  const visibleFields = fields.filter((field) => displayValue(field.value).trim() !== "");

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white" aria-labelledby="workspace-customer-title">
      <div className="border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <h3 id="workspace-customer-title" className="text-sm font-semibold text-[var(--color-ink)]">Customer information</h3>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 sm:px-5 sm:py-2">
        {visibleFields.map((field) => {
          const value = displayValue(field.value);
          const href = field.kind === "email" ? `mailto:${value}` : field.kind === "phone" ? `tel:${value}` : null;
          const isWebsite = field.kind === "website" && /^https?:\/\//i.test(value);
          return (
            <div key={field.label} className={`min-w-0 border-b border-[var(--color-border)] px-4 py-3 last:border-0 sm:px-0 ${field.wide ? "sm:col-span-2" : ""}`}>
              <dt className="text-xs font-medium text-[var(--color-muted)]">{field.label}</dt>
              <dd className="mt-1 break-words text-sm text-[var(--color-ink)]">
                {href ? <a className="underline decoration-[var(--color-border)] underline-offset-2 hover:text-[var(--color-brand)]" href={href}>{value}</a>
                  : isWebsite ? <a className="underline decoration-[var(--color-border)] underline-offset-2 hover:text-[var(--color-brand)]" href={value} target="_blank" rel="noreferrer">{value}</a>
                    : value}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="space-y-3 border-t border-[var(--color-border)] bg-slate-50/70 px-4 py-3 text-xs text-[var(--color-muted)] sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <span>Created <DateTimeDisplay date={lead.createdAt} /></span>
          <span>By {lead.createdBy?.name ?? "System"}</span>
          <span>Updated <DateTimeDisplay date={lead.updatedAt} /></span>
          {lead.updatedBy?.name && <span>By {lead.updatedBy.name}</span>}
          {lead.importedAt && <span>Imported <DateTimeDisplay date={lead.importedAt} /></span>}
        </div>
        {(lead.firstContactedAt || lead.lastContactedAt || lead.closedAt) && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <h4 className="mb-2 font-semibold text-[var(--color-ink)]">Lead timing</h4>
            <dl className="flex flex-wrap gap-x-5 gap-y-2">
              {lead.firstContactedAt && <div className="flex gap-1"><dt>First contacted</dt><dd><DateTimeDisplay date={lead.firstContactedAt} /></dd></div>}
              {lead.lastContactedAt && <div className="flex gap-1"><dt>Last contacted</dt><dd><DateTimeDisplay date={lead.lastContactedAt} /></dd></div>}
              {lead.closedAt && <div className="flex gap-1"><dt>Closed</dt><dd><DateTimeDisplay date={lead.closedAt} /></dd></div>}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
