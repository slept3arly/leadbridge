import type { ReactNode } from "react";

export function InteractionLayout({
  main,
  sidebar,
}: {
  main: ReactNode;
  sidebar?: ReactNode;
}) {
  if (!sidebar) {
    return <div className="space-y-3">{main}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
      <div className="space-y-3">{main}</div>
      <div className="space-y-3">{sidebar}</div>
    </div>
  );
}
