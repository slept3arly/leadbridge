import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Navbar } from "@/components/shared/navbar";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { AttentionCenter } from "@/components/sales/attention-center";
import { requireSession } from "@/lib/session";
import { attentionService } from "@/services/attention.service";
import { TAG } from "@/lib/cache-tags";
import type { SectionId } from "@/components/sales/attention-center";

const TAB_MAP: Record<string, SectionId> = {
  pending: "pending",
  today: "today",
  new: "new",
  stale: "stale",
};

const getAttentionData = cache((userId: string) =>
  unstable_cache(
    async () => {
      const [pendingFollowUps, todayFollowUps, newLeads, needsAttention] = await Promise.all([
        attentionService.getPendingFollowUps(userId),
        attentionService.getTodayFollowUps(userId),
        attentionService.getNewLeads(userId),
        attentionService.getNeedsAttention(userId),
      ]);
      return { pendingFollowUps, todayFollowUps, newLeads, needsAttention };
    },
    [`attention-${userId}`],
    { tags: [TAG.ATTENTION(userId)] },
  )(),
);

export default async function SalesTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession("SALES");
  const resolvedSearchParams = await searchParams;
  const initialSection = TAB_MAP[(resolvedSearchParams.tab as string) ?? ""] ?? undefined;

  const { pendingFollowUps, todayFollowUps, newLeads, needsAttention } = await getAttentionData(user.id);

  return (
    <>
      <Navbar title="Attention Center" showResync actions={<SignOutButton />} />
      <AttentionCenter
        pendingFollowUps={pendingFollowUps}
        todayFollowUps={todayFollowUps}
        newLeads={newLeads}
        needsAttention={needsAttention}
        initialSection={initialSection}
      />
    </>
  );
}
