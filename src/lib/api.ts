import { NextResponse } from "next/server";
import { getSession, canAccessProtectedSession, type AppRole, type AppSession } from "@/lib/session";
import { ServiceError } from "@/lib/service-errors";
import { can, type Permission } from "@/lib/permissions";

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export type ApiHandler<C = unknown> = (request: Request, context: C, session: AppSession) => Promise<Response>;

export function withApiAuthorization<C = unknown>(role: AppRole | AppRole[] | undefined, handler: ApiHandler<C>) {
  return async (request: Request, context: C) => {
    const session = await getSession();
    if (!session) {
      return apiError("Authentication required.", 401);
    }
    if (!canAccessProtectedSession(session)) {
      return apiError("Account is not active.", 403);
    }

    const roles = role ? (Array.isArray(role) ? role : [role]) : undefined;
    if (roles && !roles.includes(session.user.role)) {
      return apiError("You do not have permission to perform this action.", 403);
    }

    return handler(request, context, session);
  };
}

export function withPermissionAuthorization<C = unknown>(permission: Permission, handler: ApiHandler<C>) {
  return async (request: Request, context: C) => {
    const session = await getSession();
    if (!session) {
      return apiError("Authentication required.", 401);
    }
    if (!canAccessProtectedSession(session)) {
      return apiError("Account is not active.", 403);
    }
    if (!can(session.user, permission)) {
      return apiError("You do not have permission to perform this action.", 403);
    }
    return handler(request, context, session);
  };
}

export function parseJsonError(error: unknown) {
  return error instanceof SyntaxError ? apiError("Invalid JSON body.", 400) : null;
}

export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return apiError(error.message, error.status);
  }

  return apiError(error instanceof Error ? error.message : fallbackMessage, 500);
}
