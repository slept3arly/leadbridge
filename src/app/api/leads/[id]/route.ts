import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { leadSchema } from "@/lib/validation";
import { leadService } from "@/services/lead.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user } = await requireSession();
  const parsed = leadSchema.partial().safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const lead = await leadService.update(id, parsed.data, user.id);

  return NextResponse.json(lead);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user } = await requireSession("ADMIN");
  const { id } = await context.params;
  await leadService.remove(id, user.id);
  return new NextResponse(null, { status: 204 });
}
