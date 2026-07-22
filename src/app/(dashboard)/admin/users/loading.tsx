import { SkeletonTable } from "@/components/ui/loading";

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/60 bg-white/85 p-5 animate-pulse">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-1 h-8 w-48 rounded bg-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
      <SkeletonTable rows={5} cols={9} />
    </div>
  );
}
