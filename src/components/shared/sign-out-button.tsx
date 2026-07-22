"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setPending(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => router.push("/login"),
          },
        });
      }}
      disabled={pending}
      aria-label="Sign out"
      title="Sign out"
      className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink)] transition hover:bg-slate-50 hover:text-[var(--color-ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 h-9 w-9 p-1.5"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <LogOut size={16} aria-hidden="true" />
      )}
    </button>
  );
}
