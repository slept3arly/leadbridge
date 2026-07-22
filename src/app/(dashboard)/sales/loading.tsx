import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

export default function SalesLoading() {
  return (
    <div className="space-y-6">
      {/* Navbar skeleton — mirrors Navbar layout exactly */}
      <div className="rounded-2xl border border-white/60 bg-white/85 p-5 animate-pulse">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-1 h-8 w-40 rounded bg-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 rounded-xl bg-slate-200" />
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}
