import { SkeletonCard } from "@/components/ui/loading";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/60 bg-white/85 p-5">
        <Block className="h-3 w-20" />
        <Block className="mt-2 h-7 w-32" />
        <Block className="mt-2 h-4 w-56" />
      </div>
      <SkeletonCard />
      <div className="flex justify-end gap-2"><Block className="h-9 w-28" /><Block className="h-9 w-32" /></div>
    </div>
  );
}
