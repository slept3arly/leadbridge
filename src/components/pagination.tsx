"use client";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <span className="text-sm text-[var(--color-muted)]">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-[var(--color-muted)]">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`
                  flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition
                  ${
                    p === page
                      ? "bg-[var(--color-brand)] text-white"
                      : "text-[var(--color-muted)] hover:bg-slate-100"
                  }
                `}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </button>
            )
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
