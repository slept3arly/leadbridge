"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function UserIdField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <div className="mt-px flex items-center gap-1.5">
        <code className="break-all text-sm font-medium text-[var(--color-ink)] leading-snug">{value}</code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded p-0.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}
