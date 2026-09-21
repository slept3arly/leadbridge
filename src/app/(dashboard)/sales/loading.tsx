import { Card } from "@/components/ui/card";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`} />;
}

function SkeletonKpiCard() {
  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="h-8 w-12 shrink-0" />
      </div>
    </Card>
  );
}

function SkeletonPipelineCard() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-16 rounded-full" />
        <SkeletonBlock className="h-6 w-8" />
      </div>
    </Card>
  );
}

export default function SalesLoading() {
  return (
    <>
      {/* Navbar skeleton — mirrors Navbar layout */}
      <div className="relative z-10 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-1 h-7 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* Dashboard content skeleton */}
      <div className="space-y-8">
        {/* Section 1: What Needs My Attention — 4 KPI cards */}
        <section>
          <SkeletonBlock className="mb-4 h-5 w-52" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </div>
        </section>

        {/* Section 2: My Pipeline — 5 status + 4 priority */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-3">
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
            <SkeletonPipelineCard />
          </div>
        </section>

        {/* Section 3: Today's Activity — 4 + 3 KPI cards */}
        <section>
          <SkeletonBlock className="mb-4 h-5 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </div>
        </section>

        {/* Section 4: Upcoming Follow-ups — table */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                  <th className="px-4 py-3"><SkeletonBlock className="h-3 w-12" /></th>
                  <th className="px-4 py-3"><SkeletonBlock className="h-3 w-12" /></th>
                  <th className="px-4 py-3"><SkeletonBlock className="h-3 w-12" /></th>
                  <th className="px-4 py-3"><SkeletonBlock className="h-3 w-16" /></th>
                  <th className="px-4 py-3"><SkeletonBlock className="h-3 w-12" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><SkeletonBlock className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><SkeletonBlock className="h-4 w-12" /></td>
                    <td className="px-4 py-3">
                      <SkeletonBlock className="h-4 w-20 mb-1" />
                      <SkeletonBlock className="h-3 w-10" />
                    </td>
                    <td className="px-4 py-3"><SkeletonBlock className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><SkeletonBlock className="h-5 w-16 rounded-full" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </>
  );
}
