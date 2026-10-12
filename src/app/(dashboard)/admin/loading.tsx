import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

function SkeletonSection({
  titleWidth = "w-40",
  count,
  gridClass,
}: {
  titleWidth?: string;
  count: number;
  gridClass: string;
}) {
  return (
    <section>
      <div className="mb-4">
        <div className={`h-5 ${titleWidth} animate-pulse rounded bg-slate-200`} />
        <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className={gridClass}>
        {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} className="p-4" />)}
      </div>
    </section>
  );
}

export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <SkeletonSection titleWidth="w-36" count={3} gridClass="grid grid-cols-2 gap-3 sm:grid-cols-3" />
      <section>
        <div className="mb-4">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <SkeletonCard key={`status-${index}`} className="p-4" />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={`priority-${index}`} className="p-4" />)}
        </div>
      </section>
      <SkeletonSection titleWidth="w-56" count={5} gridClass="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" />
      <SkeletonSection titleWidth="w-48" count={4} gridClass="grid grid-cols-2 gap-3 sm:grid-cols-4" />
      <section>
        <div className="mb-4">
          <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <SkeletonTable rows={5} cols={7} />
      </section>
      <section>
        <div className="mb-4">
          <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <SkeletonCard key={`connector-${index}`} className="p-4" />)}
        </div>
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200" />
        <SkeletonTable rows={5} cols={5} />
      </section>
      <section>
        <div className="mb-4">
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
        </div>
        <SkeletonTable rows={10} cols={4} />
      </section>
    </div>
  );
}
