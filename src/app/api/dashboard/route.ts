import { NextResponse } from "next/server";
import { withApiAuthorization, handleApiError } from "@/lib/api";
import { dashboardService } from "@/services/dashboard.service";

export const GET = withApiAuthorization(["ADMIN", "SALES"], async (request, _ctx, session) => {
  try {
    if (session.user.role === "ADMIN") {
      const data = await dashboardService.admin();
      return NextResponse.json({ data });
    }

    const data = await dashboardService.sales(session.user.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "Dashboard data fetch failed");
  }
});
