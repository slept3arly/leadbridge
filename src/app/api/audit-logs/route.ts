import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { auditService } from "@/services/audit.service";

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const url = new URL(request.url);
  const query = {
    page: Math.max(1, Number(url.searchParams.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 50)),
    search: url.searchParams.get("search") || undefined,
    action: url.searchParams.get("action") || undefined,
    entityType: url.searchParams.get("entityType") || undefined,
    actorId: url.searchParams.get("actorId") || undefined,
  };
  return NextResponse.json(await auditService.listPage(query));
});
