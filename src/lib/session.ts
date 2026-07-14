import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type AppRole = "ADMIN" | "SALES";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>> & {
  user: {
    id: string;
    role: AppRole;
    active: boolean;
    banned?: boolean;
    name: string;
    email: string;
  };
};

export async function getSession() {
  return auth.api.getSession({ headers: await headers() }) as Promise<AppSession | null>;
}

export async function requireSession(role?: AppRole) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.active || session.user.banned) {
    redirect("/login");
  }

  if (role && session.user.role !== role) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/sales");
  }

  return session;
}
