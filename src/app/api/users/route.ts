import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withApiAuthorization, apiError } from "@/lib/api";
import { userSchema } from "@/lib/validation";
import { userService } from "@/services/user.service";

export const GET = withApiAuthorization("ADMIN", async (request) => {
  const users = await userService.listPage(new URL(request.url).searchParams);
  return NextResponse.json(users);
});

export const POST = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = userSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { salesPrivilege, ...userData } = parsed.data;

  if (userData.role === "SALES") {
    (userData as Record<string, unknown>).salesPrivilege = salesPrivilege ?? "JUNIOR";
  }

  const created = await auth.api.createUser({
    headers: await headers(),
    body: userData,
  });

  await userService.markCreated(created.user.id, session.user.id);

  return NextResponse.json(created, { status: 201 });
});
