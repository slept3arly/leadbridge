function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`} />;
}

function SkeletonToolbarRow() {
  return (
    <tr className="animate-pulse">
      {/* # */}
      <td className="px-5 py-4 align-top w-12">
        <SkeletonBlock className="h-4 w-6" />
      </td>
      {/* Lead — 3 lines: name, company, phone */}
      <td className="px-5 py-4 align-top">
        <div className="min-w-0 max-w-[220px] space-y-1.5">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-3.5 w-20" />
          <SkeletonBlock className="h-3.5 w-24" />
        </div>
      </td>
      {/* Status / Priority — badge shapes */}
      <td className="px-5 py-4 align-top">
        <div className="flex flex-col gap-1 w-fit">
          <div className="flex items-center gap-1">
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-5 w-[76px] rounded-full" />
          </div>
          <SkeletonBlock className="h-5 w-32 rounded-full" />
        </div>
      </td>
      {/* Source */}
      <td className="px-5 py-4 align-top">
        <SkeletonBlock className="h-4 w-20" />
      </td>
      {/* Last Activity — 2 lines */}
      <td className="px-5 py-4 align-top">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3.5 w-16" />
        </div>
      </td>
      {/* Next Follow-up — date + badge */}
      <td className="px-5 py-4 align-top">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-20 rounded" />
        </div>
      </td>
      {/* Actions — button + icon row */}
      <td className="px-5 py-4 align-top text-center">
        <div className="flex flex-col gap-1.5 min-w-[130px] items-center">
          <SkeletonBlock className="h-8 w-28 rounded-md" />
          <div className="flex items-center justify-center gap-1">
            <SkeletonBlock className="h-7 w-7 rounded-md" />
            <SkeletonBlock className="h-7 w-7 rounded-md" />
            <SkeletonBlock className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function SalesMyLeadsLoading() {
  return (
    <>
      {/* Navbar skeleton — mirrors Navbar layout */}
      <div className="relative z-10 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-1 h-7 w-40" />
          <SkeletonBlock className="mt-1 h-3.5 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* Controls + Table */}
      <div className="space-y-4">
        {/* Row 1: Search + Create Lead + Filters */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <div className="relative w-full">
              <SkeletonBlock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded" />
              <div className="w-full rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-4 py-2">
                <SkeletonBlock className="h-4 w-32" />
              </div>
            </div>
          </div>
          <SkeletonBlock className="h-9 w-32 shrink-0 rounded-md" />
          <SkeletonBlock className="h-9 w-24 shrink-0 rounded-md" />
        </div>

        {/* Row 2: Segmented tabs + Pagination */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl bg-slate-100/80 p-1">
              <SkeletonBlock className="rounded-lg px-3 py-1.5 h-8 w-14" />
              <SkeletonBlock className="rounded-lg px-3 py-1.5 h-8 w-18" />
              <SkeletonBlock className="rounded-lg px-3 py-1.5 h-8 w-14" />
              <SkeletonBlock className="rounded-lg px-3 py-1.5 h-8 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-8 w-8 rounded-md" />
            <SkeletonBlock className="h-4 w-12" />
            <SkeletonBlock className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* DataTable skeleton — 7 columns */}
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm" role="table">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] w-12">#</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Lead</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Status / Priority</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Source</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Last Activity</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">Next Follow-up</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonToolbarRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
