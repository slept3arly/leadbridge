"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null,
  );
}

export function useAccessibleDialog<T extends HTMLElement>({
  open,
  onClose,
  canClose = true,
}: {
  open: boolean;
  onClose: () => void;
  canClose?: boolean;
}) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  useEffect(() => {
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  }, [onClose, canClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusInitial = window.requestAnimationFrame(() => {
      if (!dialog.isConnected) return;
      const initial = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? getFocusable(dialog)[0] ?? dialog;
      initial.focus();
    });

    const isTopDialog = () => {
      const dialogs = document.querySelectorAll<HTMLElement>("[data-accessible-dialog]");
      return dialogs.item(dialogs.length - 1) === dialog;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return;

      if (event.key === "Escape") {
        if (canCloseRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      } else {
        const remainingDialogs = Array.from(document.querySelectorAll<HTMLElement>("[data-accessible-dialog]"))
          .filter((remaining) => remaining !== dialog);
        remainingDialogs[remainingDialogs.length - 1]?.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return dialogRef;
}
