"use client";

import { Button } from "@/components/ui/button";

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="flex items-center justify-between text-sm"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button></div></div>;
}
