import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { reportService } from "@/services/report.service";

function parseDateRange(searchParams: URLSearchParams): { from?: Date; to?: Date } {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  return {
    ...(from ? { from: new Date(from) } : {}),
    ...(to ? { to: new Date(to) } : {}),
  };
}

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const range = parseDateRange(searchParams);
  const dateRange = range.from || range.to ? range as { from: Date; to: Date } : undefined;
  if (dateRange && !(dateRange.from && dateRange.to)) {
    return apiError("Both 'from' and 'to' are required for date range", 400);
  }

  try {
    switch (type) {
      case "summary": {
        const data = await reportService.leadSummary(dateRange);
        return NextResponse.json({ data });
      }
      case "sources": {
        const data = await reportService.leadSources(dateRange);
        return NextResponse.json({ data });
      }
      case "assignments": {
        const data = await reportService.assignments(dateRange);
        return NextResponse.json({ data });
      }
      case "activity": {
        const data = await reportService.activity();
        return NextResponse.json({ data });
      }
      case "trends": {
        const data = await reportService.monthlyTrends();
        return NextResponse.json({ data });
      }
      case "status": {
        const data = await reportService.statusBreakdown(dateRange);
        return NextResponse.json({ data });
      }
      default:
        return apiError(`Unknown report type: ${type}. Supported: summary, sources, assignments, activity, trends, status`, 400);
    }
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Report generation failed", 500);
  }
});
