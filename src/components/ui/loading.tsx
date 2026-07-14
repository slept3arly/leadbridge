"use client";

import { cn } from "@/lib/utils";

// 1. LoadingSpinner: Standard spinner component
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-current",
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// 2. ButtonSpinner: Small spinner optimized for inside buttons
export function ButtonSpinner({ className }: { className?: string }) {
  return <LoadingSpinner className={cn("h-4 w-4 border-2", className)} />;
}

// 3. LoadingOverlay: Full/relative panel overlay with blur
export function LoadingOverlay({
  className,
  label = "Loading...",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-xs transition-opacity duration-200 dark:bg-slate-900/70",
        className
      )}
    >
      <LoadingSpinner className="h-8 w-8 text-[var(--color-brand)]" />
      {label && (
        <p className="mt-2 text-sm font-medium text-[var(--color-muted)]">
          {label}
        </p>
      )}
    </div>
  );
}

// 4. PageLoader: Full page height center loader
export function PageLoader({ label = "Loading page..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center p-6">
      <LoadingSpinner className="h-10 w-10 text-[var(--color-brand)]" />
      {label && (
        <p className="mt-3 text-sm font-medium text-[var(--color-muted)] animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}

// 5. SkeletonCard: Loading card skeleton
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-xs",
        className
      )}
    >
      <div className="h-4 w-1/3 rounded bg-slate-200 mb-4" />
      <div className="h-8 w-2/3 rounded bg-slate-200 mb-6" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// 6. SkeletonTable: Loading table skeleton
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white", className)}>
      <div className="border-b border-[var(--color-border)] bg-slate-50 px-6 py-4">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-slate-200"
              style={{ width: `${100 / cols - 5}%` }}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[var(--color-border)] px-6 py-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 py-4 animate-pulse">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 rounded bg-slate-100"
                style={{ width: `${100 / cols - 5}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. SkeletonList: Loading list view skeleton
export function SkeletonList({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center justify-between rounded-xl border border-[var(--color-border)] bg-white p-4"
        >
          <div className="flex items-center gap-3 w-2/3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
            <div className="w-full space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-6 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
