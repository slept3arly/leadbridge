export function InteractionHeader({
  name,
  createdAt,
}: {
  name: string;
  createdAt: string;
}) {
  const d = new Date(createdAt);
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <p className="text-sm font-bold text-[var(--color-ink)]">{name}</p>
      <p className="text-xs text-[var(--color-muted)]">
        {date} · {time}
      </p>
    </div>
  );
}
