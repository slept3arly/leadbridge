type LeadDetail = {
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  source: { id: string; name: string; sourceType: string } | null;
  connector: { id: string; name: string; type: string } | null;
  sourceName: string | null;
  sourceType: string | null;
  importedAt: string | null;
  parserVersion: string | null;
  sourceReferenceId: string | null;
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

export function LeadMetadataCard({ lead }: { lead: LeadDetail }) {
  const created = formatDateTime(lead.createdAt);
  const updated = formatDateTime(lead.updatedAt);
  const imported = formatDateTime(lead.importedAt);

  const isImported = !!lead.source || !!lead.connector || !!lead.importedAt;
  const isManual = !isImported;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-[var(--color-border)]">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Record Information</h4>
      </div>
      <div className="divide-y divide-[var(--color-border)] text-sm">
        <div className="grid grid-cols-3 gap-2 px-4 py-2">
          <span className="text-[var(--color-muted)]">Created</span>
          <span className="col-span-2 font-medium">
            {created ? `${created.date} at ${created.time}` : "-"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 py-2">
          <span className="text-[var(--color-muted)]">Created By</span>
          <span className="col-span-2 font-medium">{lead.createdBy?.name ?? "System"}</span>
        </div>

        {isImported && (
          <>
            {lead.importedAt && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Imported</span>
                <span className="col-span-2 font-medium">
                  {imported ? `${imported.date} at ${imported.time}` : "-"}
                </span>
              </div>
            )}
            {lead.source && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Source</span>
                <span className="col-span-2 font-medium">{lead.source.name}</span>
              </div>
            )}
            {lead.connector && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Connector</span>
                <span className="col-span-2 font-medium">{lead.connector.name} ({lead.connector.type})</span>
              </div>
            )}
            {lead.sourceName && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Provider Name</span>
                <span className="col-span-2 font-medium">{lead.sourceName}</span>
              </div>
            )}
            {lead.sourceType && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Source Type</span>
                <span className="col-span-2 font-medium">{lead.sourceType}</span>
              </div>
            )}
            {lead.parserVersion && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Parser</span>
                <span className="col-span-2 font-medium">{lead.parserVersion}</span>
              </div>
            )}
            {lead.sourceReferenceId && (
              <div className="grid grid-cols-3 gap-2 px-4 py-2">
                <span className="text-[var(--color-muted)]">Source Ref</span>
                <span className="col-span-2 font-medium font-mono text-xs">{lead.sourceReferenceId}</span>
              </div>
            )}
          </>
        )}

        {isManual && (
          <div className="grid grid-cols-3 gap-2 px-4 py-2">
            <span className="text-[var(--color-muted)]">Source</span>
            <span className="col-span-2 font-medium">Manual Entry</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 px-4 py-2">
          <span className="text-[var(--color-muted)]">Updated</span>
          <span className="col-span-2 font-medium">
            {updated ? `${updated.date} at ${updated.time}` : "-"}
          </span>
        </div>
        {lead.updatedBy && (
          <div className="grid grid-cols-3 gap-2 px-4 py-2">
            <span className="text-[var(--color-muted)]">Updated By</span>
            <span className="col-span-2 font-medium">{lead.updatedBy.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
