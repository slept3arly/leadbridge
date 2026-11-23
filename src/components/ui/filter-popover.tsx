"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

/** Controlled filter popup with one dismissal owner for its trigger and content. */
export function FilterPopover({
  open,
  onOpenChange,
  trigger,
  children,
  contentClassName,
}: FilterPopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="end"
          side="bottom"
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Radix Select uses a modal DismissableLayer and disables body
          // pointer events while its menu is open. Keep this lower layer
          // interactive so clicks on other filter controls reach this popover
          // (and dismiss only the Select layer).
          style={{ pointerEvents: "auto" }}
          className={cn(
            "z-50 max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-xl",
            contentClassName,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
