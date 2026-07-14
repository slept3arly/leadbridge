import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export async function GET() {
  await requireSession("ADMIN");

  return NextResponse.json({
    status: "stub",
    message: "Reporting endpoints are reserved for the analytics milestone.",
  });
}
