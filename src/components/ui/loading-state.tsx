export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <p className="text-sm text-[var(--color-muted)]">{label}</p>;
}
