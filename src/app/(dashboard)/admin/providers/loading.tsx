import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function AdminProvidersLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2"><Block className="h-3 w-20" /><Block className="h-7 w-40" /><Block className="h-4 w-64" /></div>
        <div className="flex flex-wrap gap-2"><Block className="h-9 w-9" /><Block className="h-9 w-36" /><Block className="h-9 w-9" /><Block className="h-9 w-9" /></div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><Block className="h-10 flex-1" /><Block className="h-10 w-full sm:w-36" /><Block className="h-10 w-full sm:w-36" /></div>
      <SkeletonTable rows={6} cols={8} compact />
      <SkeletonCard className="h-72" />
    </div>
  );
}
