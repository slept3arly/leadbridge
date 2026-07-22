"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function AnimatedReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
    );
  }, []);

  return <div ref={ref}>{children}</div>;
}
