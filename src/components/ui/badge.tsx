import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ADMIN: "bg-slate-900 text-white",
  SALES: "bg-blue-100 text-blue-800",
  NEW: "bg-blue-100 text-blue-800",
  OPEN: "bg-indigo-100 text-indigo-800",
  CONTACTED: "bg-amber-100 text-amber-800",
  ATTEMPTED_CONTACT: "bg-orange-100 text-orange-800",
  FOLLOW_UP_SCHEDULED: "bg-purple-100 text-purple-800",
  INTERESTED: "bg-teal-100 text-teal-800",
  QUALIFIED: "bg-emerald-100 text-emerald-800",
  PROPOSAL_SENT: "bg-cyan-100 text-cyan-800",
  NEGOTIATION: "bg-violet-100 text-violet-800",
  WAITING_FOR_CUSTOMER: "bg-yellow-100 text-yellow-800",
  ON_HOLD: "bg-slate-100 text-slate-700",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-rose-100 text-rose-800",
  DISQUALIFIED: "bg-gray-100 text-gray-700",
  SPAM: "bg-red-50 text-red-400",
  ARCHIVED: "bg-slate-100 text-slate-400",
  VERY_LOW: "bg-sky-50 text-sky-600",
  LOW: "bg-sky-100 text-sky-700",
  MEDIUM: "bg-slate-100 text-slate-700",
  HIGH: "bg-orange-100 text-orange-800",
  VERY_HIGH: "bg-orange-200 text-orange-900",
  URGENT: "bg-red-100 text-red-800",
  CRITICAL: "bg-red-200 text-red-900",
} as const;

export function Badge({ label }: { label: string }) {
  const tone = tones[label as keyof typeof tones] ?? "bg-slate-100 text-slate-700";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}
