import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { leadSchema } from "@/lib/validation";
import { leadService } from "@/services/lead.service";

export async function GET() {
  const { user } = await requireSession();
  const leads = await leadService.list(user.role === "SALES" ? user.id : undefined);
  return NextResponse.json(leads);
}

export async function POST(request: Request) {
  const { user } = await requireSession();
  const parsed = leadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const lead = await leadService.create(parsed.data, user.id);
  return NextResponse.json(lead, { status: 201 });
}
