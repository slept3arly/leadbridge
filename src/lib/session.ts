import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type AppRole = "ADMIN" | "SALES";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>> & {
  user: {
    id: string;
    role: AppRole;
    salesPrivilege?: "JUNIOR" | "SENIOR" | null;
    active: boolean;
    isDeleted: boolean;
    banned?: boolean;
    name: string;
    email: string;
  };
};

export function canAccessProtectedSession(session: AppSession | null): session is AppSession {
  return Boolean(session && session.user.active && !session.user.banned && !session.user.isDeleted);
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() }) as Promise<AppSession | null>;
}

export async function requireSession(role?: AppRole) {
  const session = await getSession();

  if (!canAccessProtectedSession(session)) {
    redirect("/login");
  }

  if (role && session.user.role !== role) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/sales");
  }

  return session;
}
