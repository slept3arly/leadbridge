import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiAuthorization, apiError } from "@/lib/api";
import { z } from "zod";

const updateUserSchema = z.object({
  salesPrivilege: z.enum(["JUNIOR", "SENIOR"]).nullable(),
});

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (request, context) => {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) return apiError("User not found.", 404);
  if (user.role !== "SALES") return apiError("Can only change sales privilege for SALES users.", 400);

  const updated = await prisma.user.update({
    where: { id },
    data: { salesPrivilege: parsed.data.salesPrivilege },
    select: { id: true, name: true, email: true, role: true, salesPrivilege: true, active: true, createdAt: true },
  });

  return NextResponse.json(updated);
});
