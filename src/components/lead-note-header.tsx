import { FollowUpBadge } from "@/components/follow-up-badge";

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

export function LeadNoteHeader({
  authorName,
  createdAt,
  followUp,
}: {
  authorName: string;
  createdAt: string;
  followUp?: { id: string; dueDate: string | null; dueTime: string | null; status: string } | null;
}) {
  const created = new Date(createdAt);
  const date = created.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = created.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3">
      <Avatar name={authorName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[var(--color-ink)]">
            {authorName}
          </span>
          {followUp && (
            <FollowUpBadge
              dueDate={followUp.dueDate}
              dueTime={followUp.dueTime}
              status={followUp.status}
            />
          )}
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          {date} · {time}
        </div>
      </div>
    </div>
  );
}
