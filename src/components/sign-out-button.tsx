"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="secondary"
      isLoading={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => router.push("/login"),
          },
        });
      }}
    >
      Sign out
    </Button>
  );
}
