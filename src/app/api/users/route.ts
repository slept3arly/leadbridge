import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { userSchema } from "@/lib/validation";
import { userService } from "@/services/user.service";

export async function GET() {
  await requireSession("ADMIN");
  const users = await userService.list();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  await requireSession("ADMIN");
  const parsed = userSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await auth.api.createUser({
    headers: await headers(),
    body: parsed.data,
  });

  return NextResponse.json(created, { status: 201 });
}
