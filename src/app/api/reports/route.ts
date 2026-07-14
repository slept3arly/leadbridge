import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";

export const GET = withApiAuthorization("ADMIN", async () => {
  return NextResponse.json({
    status: "stub",
    message: "Reporting endpoints are reserved for the analytics milestone.",
  });
});
