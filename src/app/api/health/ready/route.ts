import { NextResponse } from "next/server";
import { isDatabaseReady } from "@/lib/database-readiness";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await isDatabaseReady(() => prisma.$queryRaw`SELECT 1`);

  return NextResponse.json(
    { status: ready ? "ready" : "not_ready" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
