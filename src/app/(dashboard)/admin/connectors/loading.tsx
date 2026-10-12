import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function AdminConnectorsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2"><Block className="h-3 w-20" /><Block className="h-7 w-44" /><Block className="h-4 w-72" /></div>
        <div className="flex flex-wrap gap-2"><Block className="h-9 w-9" /><Block className="h-9 w-36" /><Block className="h-9 w-28" /><Block className="h-9 w-9" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} className="h-24" />)}</div>
      <SkeletonTable rows={5} cols={9} compact />
    </div>
  );
}
