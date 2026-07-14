import { cn } from "@/lib/utils";

const tones = {
  ADMIN: "bg-slate-900 text-white",
  SALES: "bg-blue-100 text-blue-800",
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-amber-100 text-amber-800",
  QUALIFIED: "bg-emerald-100 text-emerald-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-rose-100 text-rose-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
  MEDIUM: "bg-slate-100 text-slate-700",
  LOW: "bg-sky-100 text-sky-700",
} as const;

export function Badge({ label }: { label: string }) {
  const tone = tones[label as keyof typeof tones] ?? "bg-slate-100 text-slate-700";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}
