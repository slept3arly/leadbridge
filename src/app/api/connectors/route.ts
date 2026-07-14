import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { connectorService } from "@/services/connector.service";

export async function GET() {
  await requireSession("ADMIN");
  const connectors = await connectorService.list();
  return NextResponse.json({ data: connectors });
}
