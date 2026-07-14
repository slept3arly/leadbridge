"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      onClick={async () => {
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
