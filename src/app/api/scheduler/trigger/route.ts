import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { connectorScheduler } from "@/services/scheduler.service";

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let connectorId: string | undefined;
  try {
    const body = await request.json();
    connectorId = body.connectorId as string | undefined;
  } catch {
    // no body — run all due connectors
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
    return apiError(error instanceof Error ? error.message : "Scheduler execution failed", 500);
  }
});
