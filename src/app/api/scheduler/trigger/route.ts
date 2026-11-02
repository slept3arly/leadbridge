import { NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { canAccessProtectedSession, getSession } from "@/lib/session";
import { isSchedulerSecretAuthorized } from "@/lib/scheduler-auth";
import { connectorScheduler } from "@/services/scheduler.service";

export async function POST(request: Request) {
  const session = await getSession();
  const isAdmin = canAccessProtectedSession(session) && session.user.role === "ADMIN";
  const isMachine = isSchedulerSecretAuthorized(request);
  if (!isAdmin && !isMachine) {
    return apiError(session ? "You do not have permission to perform this action." : "Authentication required.", session ? 403 : 401);
  }

  let connectorId: string | undefined;
  try {
    const body = await request.json();
    connectorId = body.connectorId as string | undefined;
  } catch {
    // no body — run all due connectors
  }

  if (isMachine && !isAdmin && connectorId) {
    return apiError("Scheduler credentials may only run due connectors.", 400);
  }

  try {
    if (connectorId) {
      const result = await connectorScheduler.runConnectorById(connectorId);
      return NextResponse.json({ data: result });
    }

    const results = await connectorScheduler.runDue();
    return NextResponse.json({
      data: results,
      summary: {
        total: results.length,
        executed: results.filter((r) => r.status === "executed").length,
        skipped: results.filter((r) => r.status === "skipped_locked").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    });
  } catch (error) {
    return handleApiError(error, "Scheduler execution failed");
  }
}
