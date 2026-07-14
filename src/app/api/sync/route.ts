import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

export async function POST() {
  await requireSession("ADMIN");

  return NextResponse.json({
    status: "stub",
    message: "Scheduled and on-demand sync pipelines will be connected in a future iteration.",
  });
}
