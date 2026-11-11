import { Badge } from "@/components/ui/badge";
import { getCategoryLabel, getPriorityLabel, getStatusLabel } from "@/lib/lead-constants";

export function LeadStatusPriorityCell({
  status,
  priority,
  category,
}: {
  status: string;
  priority: string;
  category: string | null;
}) {
  return (
    <div className="flex w-[190px] max-w-full flex-col gap-1">
      <div className="flex items-center gap-1">
        <Badge label={getStatusLabel(status)} toneKey={status} className="w-[82px] whitespace-nowrap px-1.5 py-1 text-[11px]" />
        <Badge label={getPriorityLabel(priority)} toneKey={priority} className="w-[72px] whitespace-nowrap px-1.5 py-1 text-[11px]" />
      </div>
      {category && (
        <Badge
          label={getCategoryLabel(category)}
          toneKey={category}
          className="w-[158px] max-w-full whitespace-normal break-words px-1.5 py-1 text-center text-[11px] leading-tight"
        />
      )}
    </div>
  );
}
