import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { parseLegacyReportExport } from "@/lib/export/legacy-compatibility";
import { reportService } from "@/services/report.service";
import { z } from "zod";

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    const { filters } = parseLegacyReportExport(searchParams);

    switch (type) {
      case "summary": {
        const data = await reportService.leadSummary(undefined, filters);
        return NextResponse.json({ data });
      }
      case "sources": {
        const data = await reportService.leadSources(undefined, filters);
        return NextResponse.json({ data });
      }
      case "assignments": {
        const data = await reportService.assignments(undefined, filters);
        return NextResponse.json({ data });
      }
      case "activity": {
        const data = await reportService.activity(filters);
        return NextResponse.json({ data });
      }
      case "trends": {
        const data = await reportService.monthlyTrends(filters);
        return NextResponse.json({ data });
      }
      case "status": {
        const data = await reportService.statusBreakdown(undefined, filters);
        return NextResponse.json({ data });
      }
      default:
        return apiError(`Unknown report type: ${type}. Supported: summary, sources, assignments, activity, trends, status`, 400);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("Invalid report filter parameters.", 400);
    }
    return handleApiError(error, "Report generation failed");
  }
});
