"use client";

import { useState } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";

export function UserPrivilegeCell({
  userId,
  role,
  privilege,
}: {
  userId: string;
  role: string;
  privilege: string | null;
}) {
  const [current, setCurrent] = useState(privilege);

  if (role !== "SALES") {
    return <span className="text-xs text-[var(--color-muted)]">-</span>;
  }

  const toggle = async () => {
    const next = current === "SENIOR" ? "JUNIOR" : "SENIOR";
    try {
      await axios.patch(`/api/users/${userId}`, { salesPrivilege: next });
      setCurrent(next);
      toast.success(`Privilege changed to ${next}`);
    } catch {
      toast.error("Failed to update privilege");
    }
  };

  return (
    <button
      onClick={toggle}
      className="cursor-pointer hover:opacity-80 transition"
      title={`Click to toggle (currently ${current ?? "JUNIOR"})`}
    >
      <Badge label={current ?? "JUNIOR"} />
    </button>
  );
}
