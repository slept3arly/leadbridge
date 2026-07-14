import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { parseListQuery } from "@/lib/query-builder";
import { connectorService } from "@/services/connector.service";

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const connectors = await connectorService.listPage(parseListQuery(new URL(request.url).searchParams));
  return NextResponse.json(connectors);
});
