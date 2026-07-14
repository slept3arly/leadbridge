import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";

export const GET = withApiAuthorization("ADMIN", async () => {
  return NextResponse.json({
    status: "stub",
    message: "Settings APIs are scaffolded and ready for future implementation.",
  });
});
