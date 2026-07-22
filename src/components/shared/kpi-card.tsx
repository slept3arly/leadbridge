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
        <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
        <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{count}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      </Card>
    </Link>
  );
}
