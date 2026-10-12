import { SkeletonTable } from "@/components/ui/loading";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function AdminLeadsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/85 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Block className="h-3 w-20" />
          <Block className="h-7 w-36" />
          <Block className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Block className="h-9 w-9" />
          <Block className="h-9 w-9" />
          <Block className="h-9 w-9" />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Block className="h-10 w-full sm:flex-1" />
        <div className="flex flex-wrap gap-2">
          <Block className="h-10 w-28" />
          <Block className="h-10 w-28" />
          <Block className="h-10 w-24" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Block className="h-9 w-44" />
        </div>
        <div className="flex items-center gap-3">
          <Block className="h-4 w-28" />
          <Block className="h-8 w-20" />
        </div>
      </div>
      <SkeletonTable rows={8} cols={7} compact />
    </div>
  );
}
