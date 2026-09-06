import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { invalidateAdminDashboard } from "@/lib/cache-tags";

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const { id } = await context.params;

  try {
    const existing = await prisma.leadSource.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return apiError("Lead source not found.", 404);
    }

    // Safely deactivate to prevent breaking historical leads or FK constraints
    await prisma.leadSource.update({
      where: { id },
      data: { active: false },
    });

    await auditService.log("provider.deleted", "LeadSource", id, session.user.id, { name: existing.name });
    invalidateAdminDashboard();

    return NextResponse.json({ success: true, message: `Lead source "${existing.name}" deactivated.` });
  } catch (error) {
    return handleApiError(error, "Failed to delete lead source.");
  }
});
