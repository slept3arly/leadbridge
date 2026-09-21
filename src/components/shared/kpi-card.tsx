import Link from "next/link";
import { Card } from "@/components/ui/card";

export function KpiCard({
  title,
  count,
  description,
  href,
}: {
  title: string;
  count: number;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="cursor-pointer transition hover:shadow-md p-4 h-full">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-ink)] leading-tight">{title}</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)] leading-tight">{description}</p>
          </div>
          <p className="text-3xl font-bold text-[var(--color-ink)] tabular-nums whitespace-nowrap">{count}</p>
        </div>
      </Card>
    </Link>
  );
}
