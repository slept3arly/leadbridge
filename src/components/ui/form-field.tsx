import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  error?: string | null;
  errorId?: string;
  helperText?: string;
  required?: boolean;
  labelSuffix?: "Required" | "Optional";
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  error,
  errorId,
  helperText,
  required,
  labelSuffix,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {labelSuffix ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">
              {labelSuffix}
            </span>
          ) : required ? (
            <span className="ml-1 text-[var(--color-danger)]" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
      )}
      {children}
      {error && (
        <p id={errorId} className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-[var(--color-muted)]">{helperText}</p>
      )}
    </div>
  );
}
