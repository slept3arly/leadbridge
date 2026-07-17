import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { exportService } from "@/services/export.service";

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) {
    return apiError("Query parameter 'type' is required. Supported values: leads, users, providers, sync-history", 400);
  }

  try {
    let csv: string;

    switch (type) {
      case "leads": {
        const status = searchParams.get("status")?.split(",").filter(Boolean);
        const assignedUserId = searchParams.get("assignedUserId") || undefined;
        const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
        const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
        const search = searchParams.get("search") || undefined;
        csv = await exportService.exportLeads({ status, assignedUserId, from, to, search });
        break;
      }
      case "users": {
        csv = await exportService.exportUsers();
        break;
      }
      case "providers": {
        csv = await exportService.exportProviders();
        break;
      }
      case "sync-history": {
        const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
        const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
        const connectorId = searchParams.get("connectorId") || undefined;
        csv = await exportService.exportSyncHistory({ from, to, connectorId });
        break;
      }
      default:
        return apiError(`Unknown export type: ${type}. Supported: leads, users, providers, sync-history`, 400);
    }

    const filename = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Export failed", 500);
  }
});
