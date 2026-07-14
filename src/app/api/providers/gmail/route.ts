import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { connectorService } from "@/services/connector.service";

export const GET = withApiAuthorization("ADMIN", async () => NextResponse.json({ data: await connectorService.listGmailAccounts() }));
