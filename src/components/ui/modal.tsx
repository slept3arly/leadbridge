export function Modal({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_20px_50px_rgba(19,36,77,0.12)]">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
