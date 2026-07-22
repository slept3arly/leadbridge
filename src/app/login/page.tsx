import { redirect } from "next/navigation";
import { AnimatedReveal } from "@/components/ui/animated-reveal";
import { LoginForm } from "@/components/login-form";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { BlueprintBackground } from "@/components/shared/blueprint-background";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/sales");
  }

  return (
    <>
      <BlueprintBackground />
      <div className="relative grid min-h-screen items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-12">
      <AnimatedReveal>
        <div className="hidden max-w-xl md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
            LEADBRIDGE
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-[var(--color-ink)]">
            Internal CRM Platform
          </h1>
          <p className="mt-3 text-base text-[var(--color-muted)]">
            Lead operations for your sales team.
          </p>
          <p className="mt-10 max-w-md text-sm text-[var(--color-muted)]">
            Sign in with your administrator-provided credentials. There is no public signup.
          </p>
        </div>
      </AnimatedReveal>
      <AnimatedReveal>
        <Card className="mx-auto w-full max-w-lg p-8">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription className="mt-1.5">
            Admin-managed credentials are required to access the platform.
          </CardDescription>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Card>
      </AnimatedReveal>
    </div>
    </>
  );
}
