import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";

export const POST = withApiAuthorization("ADMIN", async () => {
  return NextResponse.json({
    status: "stub",
    message: "Scheduled and on-demand sync pipelines will be connected in a future iteration.",
  });
});
