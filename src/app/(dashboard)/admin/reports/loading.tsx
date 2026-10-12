import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function AdminReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2"><Block className="h-3 w-20" /><Block className="h-7 w-32" /><Block className="h-4 w-72" /></div>
        <div className="flex flex-wrap gap-2"><Block className="h-9 w-36" /><Block className="h-9 w-9" /><Block className="h-9 w-9" /><Block className="h-9 w-9" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard className="h-72" />
      <div className="grid gap-6 md:grid-cols-2"><SkeletonCard className="h-64" /><SkeletonCard className="h-64" /></div>
      <SkeletonTable rows={5} cols={2} compact />
      <div className="grid gap-6 md:grid-cols-2"><SkeletonCard className="h-56" /><SkeletonCard className="h-56" /></div>
    </div>
  );
}
