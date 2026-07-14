import { redirect } from "next/navigation";
import { AnimatedReveal } from "@/components/animated-reveal";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/sales");
  }

  return (
    <div className="grid min-h-screen items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-12">
      <AnimatedReveal>
        <div className="max-w-xl">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--color-brand)]">LeadBridge v1</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">A clean foundation for internal lead operations.</h1>
          <p className="mt-6 max-w-lg text-lg text-[var(--color-muted)]">
            Sign in with your company-managed credentials to access protected Admin and Sales workspaces, lead workflows, and future connector pipelines.
          </p>
        </div>
      </AnimatedReveal>
      <AnimatedReveal>
        <Card className="mx-auto w-full max-w-lg">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--color-muted)]">Credentials login</p>
          <h2 className="mt-3 text-3xl font-semibold">Welcome back</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">There is no public signup. Admins manage every user account.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Card>
      </AnimatedReveal>
    </div>
  );
}
