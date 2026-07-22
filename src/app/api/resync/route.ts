import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { withApiAuthorization } from "@/lib/api";
import { TAG } from "@/lib/cache-tags";

const REV = "max" as const;

export const POST = withApiAuthorization(undefined, async (_request, _context, session) => {
  const userId = session.user.id;

  revalidateTag(TAG.DASHBOARD(userId), REV);
  revalidateTag(TAG.ATTENTION(userId), REV);

  return NextResponse.json({ success: true });
});
