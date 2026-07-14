"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPending(true);

        const formData = new FormData(event.currentTarget);
        const payload = {
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        };

        const parsed = loginSchema.safeParse(payload);
        if (!parsed.success) {
          setPending(false);
          setError(parsed.error.issues[0]?.message ?? "Invalid credentials.");
          return;
        }

        const result = await authClient.signIn.email({
          ...parsed.data,
          callbackURL: "/",
          rememberMe: true,
        });

        setPending(false);

        if (result.error) {
          setError(result.error.message ?? "Unable to sign in.");
          return;
        }

        router.push("/");
        router.refresh();
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" placeholder="admin@leadbridge.local" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input id="password" name="password" type="password" placeholder="********" required />
      </div>
      {error ? <ErrorState message={error} /> : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
