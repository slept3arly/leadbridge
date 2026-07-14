import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ml-1 text-[var(--color-danger)]" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {error && (
        <p className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-[var(--color-muted)]">{helperText}</p>
      )}
    </div>
  );
}
