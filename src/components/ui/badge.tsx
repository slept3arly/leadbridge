import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ADMIN: "bg-slate-900 text-white",
  SALES: "bg-blue-100 text-blue-800",
  NEW: "bg-blue-100 text-blue-800",
  CONVERTED: "bg-green-100 text-green-800",
  LOST: "bg-rose-100 text-rose-800",
  SPAM: "bg-red-50 text-red-400",
  ON_HOLD: "bg-amber-100 text-amber-800",
  LOW: "bg-sky-100 text-sky-700",
  MEDIUM: "bg-slate-100 text-slate-700",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
  MEDICAL_REPRESENTATIVE: "bg-teal-100 text-teal-800",
  RETAILER: "bg-blue-100 text-blue-800",
  WHOLESALER: "bg-indigo-100 text-indigo-800",
  DISTRIBUTOR: "bg-violet-100 text-violet-800",
  MARKETING: "bg-pink-100 text-pink-800",
  THIRD_PARTY: "bg-orange-100 text-orange-800",
  DOCTOR: "bg-emerald-100 text-emerald-800",
  FRANCHISE: "bg-cyan-100 text-cyan-800",
  BUSINESS: "bg-amber-100 text-amber-800",
  HOSPITAL: "bg-rose-100 text-rose-800",
  CLINIC: "bg-lime-100 text-lime-800",
  PHARMACY: "bg-green-100 text-green-800",
  LABORATORY: "bg-purple-100 text-purple-800",
  MANUFACTURER: "bg-yellow-100 text-yellow-800",
  CORPORATE: "bg-slate-100 text-slate-800",
  GOVERNMENT: "bg-red-100 text-red-800",
  OTHER: "bg-gray-100 text-gray-700",
} as const;

export function Badge({ label }: { label: string }) {
  const tone = tones[label as keyof typeof tones] ?? "bg-slate-100 text-slate-700";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}
