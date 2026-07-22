import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withApiAuthorization, apiError } from "@/lib/api";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "SALES"]).optional(),
  salesPrivilege: z.enum(["JUNIOR", "SENIOR"]).nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
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

  const { password, ...updateData } = parsed.data;

  if (updateData.role && updateData.role !== "SALES") {
    (updateData as Record<string, unknown>).salesPrivilege = null;
  }
  if (updateData.role === "SALES" && updateData.salesPrivilege === undefined) {
    if (user.role !== "SALES") {
      (updateData as Record<string, unknown>).salesPrivilege = "JUNIOR";
    }
  }

  if (password) {
    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId: id, newPassword: password },
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      salesPrivilege: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
});
