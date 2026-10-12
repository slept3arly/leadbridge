"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetch("/api/resync", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleRefresh}
      disabled={loading}
      title="Resync dashboard data"
      className="h-9 text-xs"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      Resync
    </Button>
  );
}
