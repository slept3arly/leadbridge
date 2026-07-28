import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const DELETE = withApiAuthorization("ADMIN", async (_request, context) => {
  const params = context as { params: Promise<{ id: string }> | { id: string } };
  const resolvedParams = await (typeof params.params === "object" && "then" in params.params ? params.params : Promise.resolve(params.params));
  const id = resolvedParams.id;

  const connector = await prisma.connector.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!connector) return apiError("Connector not found.", 404);

  await prisma.connector.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
