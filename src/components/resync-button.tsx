"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function ResyncButton() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    window.location.reload();
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleRefresh}
      isLoading={loading}
      className="gap-2"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      Resync
    </Button>
  );
}
