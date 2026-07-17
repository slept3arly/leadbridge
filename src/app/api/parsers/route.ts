import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { parserService } from "@/services/parser.service";

export const GET = withApiAuthorization("ADMIN", async () => {
  const manifests = parserService.list();
  return NextResponse.json({ data: manifests });
});
