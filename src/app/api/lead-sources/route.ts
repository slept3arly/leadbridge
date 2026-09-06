import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { invalidateAdminDashboard } from "@/lib/cache-tags";
import { z } from "zod";

const createSourceSchema = z.object({
  name: z.string().trim().min(2, "Lead source name must be at least 2 characters.").max(120, "Lead source name is too long."),
});

export const GET = withApiAuthorization(undefined, async () => {
  try {
    const sources = await prisma.leadSource.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, active: true },
    });
    return NextResponse.json(sources);
  } catch (error) {
    return handleApiError(error, "Failed to fetch lead sources.");
  }
});

export const POST = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Invalid input.";
    return apiError(errorMsg, 400);
  }

  const trimmedName = parsed.data.name;

  try {
    const existing = await prisma.leadSource.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      if (existing.active) {
        return apiError("A lead source with this name already exists.", 400);
      }
      // Reactivate existing source
      const reactivated = await prisma.leadSource.update({
        where: { id: existing.id },
        data: { active: true },
        select: { id: true, name: true, slug: true, active: true },
      });
      await auditService.log("provider.updated", "LeadSource", reactivated.id, session.user.id, { name: reactivated.name, reactivated: true });
      invalidateAdminDashboard();
      return NextResponse.json(reactivated, { status: 200 });
    }

    const baseSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "source";
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.leadSource.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const source = await prisma.leadSource.create({
      data: {
        name: trimmedName,
        slug,
        sourceType: "MANUAL",
        active: true,
      },
      select: { id: true, name: true, slug: true, active: true },
    });

    await auditService.log("provider.created", "LeadSource", source.id, session.user.id, { name: source.name });
    invalidateAdminDashboard();

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create lead source.");
  }
});
