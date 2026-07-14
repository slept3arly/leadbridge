import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

export default function SalesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-20 rounded-2xl border border-white/60 bg-white/85 p-5 animate-pulse">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="mt-2 h-6 w-40 rounded bg-slate-200" />
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
