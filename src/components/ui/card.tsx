import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/ui/loading";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  isLoading?: boolean;
  loadingLabel?: string;
};

export function Card({
  children,
  className,
  isLoading = false,
  loadingLabel,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-xs transition-shadow duration-200 hover:shadow-md",
        className
      )}
      {...props}
    >
      {isLoading && <LoadingOverlay label={loadingLabel} />}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border-b border-[var(--color-border)] pb-4 mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-bold tracking-tight text-[var(--color-ink)]", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[var(--color-muted)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-[var(--color-ink)]", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-[var(--color-border)] pt-4 mt-4", className)}
      {...props}
    />
  );
}

export function CardEmptyState({
  title = "No data available",
  description = "There is nothing to display here yet.",
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {icon && <div className="mb-3 text-[var(--color-muted)]">{icon}</div>}
      <h4 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h4>
      <p className="mt-1 text-xs text-[var(--color-muted)] max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
