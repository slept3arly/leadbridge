"use client";

import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoToTopButton() {
  function handleClick() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, 0);
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex justify-end">
      <Button variant="secondary" onClick={handleClick} className="gap-1.5">
        <ArrowUp size={16} aria-hidden="true" />
        Go to Top
      </Button>
    </div>
  );
}
