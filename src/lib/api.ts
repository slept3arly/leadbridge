import { NextResponse } from "next/server";
import { getSession, type AppRole, type AppSession } from "@/lib/session";

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export type ApiHandler<C = unknown> = (request: Request, context: C, session: AppSession) => Promise<Response>;

export function withApiAuthorization<C = unknown>(role: AppRole | AppRole[] | undefined, handler: ApiHandler<C>) {
  return async (request: Request, context: C) => {
    const session = await getSession();
    if (!session) return apiError("Authentication required.", 401);
    if (!session.user.active || session.user.banned || session.user.isDeleted) {
      return apiError("Account is not active.", 403);
    }

    const roles = role ? (Array.isArray(role) ? role : [role]) : undefined;
    if (roles && !roles.includes(session.user.role)) {
      return apiError("You do not have permission to perform this action.", 403);
    }

    return handler(request, context, session);
  };
}

export function parseJsonError(error: unknown) {
  return error instanceof SyntaxError ? apiError("Invalid JSON body.", 400) : null;
}
