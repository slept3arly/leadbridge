import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { connectorService } from "@/services/connector.service";

export const GET = withApiAuthorization("ADMIN", async (request) => NextResponse.json({ data: await connectorService.listSyncRuns(new URL(request.url).searchParams.get("connectorId") ?? undefined) }));
