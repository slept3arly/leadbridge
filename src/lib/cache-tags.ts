import { revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";

const REV_PROFILE = "max" as const;

// ─── Tag constants ─────────────────────────────────────────────
// Only cache stable aggregate resources (dashboard, attention).
// Lead details, notes, follow-ups, and activities always read fresh.

export const TAG = {
  DASHBOARD: (userId: string) => `dashboard:${userId}`,
  ATTENTION: (userId: string) => `attention:${userId}`,
  PROFILE: (userId: string) => `profile:${userId}`,
  USERS_LIST: "users-list",
  CONNECTORS: "connectors",
  PROVIDERS: "providers",
  ADMIN_DASHBOARD: "dashboard:admin",
  SETTINGS: "settings:global",
} as const;

// ─── Invalidation helpers ──────────────────────────────────────

function rt(tag: string) {
  try {
    revalidateTag(tag, REV_PROFILE);
  } catch (error) {
    if (error instanceof Error && /static generation store missing|incrementalCache missing/.test(error.message)) {
      return;
    }
    logger.warn({ error, tag }, "cache invalidation failed");
  }
}

export function invalidateDashboard(userId: string) {
  rt(TAG.DASHBOARD(userId));
}

export function invalidateAttention(userId: string) {
  rt(TAG.ATTENTION(userId));
}

export function invalidateProfile(userId: string) {
  rt(TAG.PROFILE(userId));
}

export type AffectedUserIds = readonly (string | null | undefined)[];

export function mutationCacheTags(userId: string, affectedUserIds: AffectedUserIds = []) {
  const userIds = new Set([userId, ...affectedUserIds.filter((id): id is string => Boolean(id))]);
  return [
    ...Array.from(userIds).flatMap((id) => [TAG.DASHBOARD(id), TAG.ATTENTION(id)]),
    TAG.ADMIN_DASHBOARD,
  ];
}

/**
 * Call after any user-driven mutation that affects dashboard counts or
 * attention-center state (lead create/update/delete, note add, follow-up
 * change, assign, archive, restore).
 *
 * Only invalidates cached aggregate views — lead details themselves are
 * never cached, so no invalidation is needed for them.
 */
export function invalidateAfterMutation(userId: string, affectedUserIds: AffectedUserIds = []) {
  for (const tag of mutationCacheTags(userId, affectedUserIds)) {
    rt(tag);
  }
}

/**
 * Run invalidation only after the mutation promise resolves successfully.
 * Returning null from getAffectedUserIds marks a successful no-op (for example,
 * a duplicate lead creation) that should not invalidate caches.
 */
export async function mutateAndInvalidate<T>(
  userId: string,
  mutation: () => Promise<T>,
  getAffectedUserIds: (result: T) => AffectedUserIds | null,
  invalidate: (userId: string, affectedUserIds?: AffectedUserIds) => void = invalidateAfterMutation,
): Promise<T> {
  const result = await mutation();
  const affectedUserIds = getAffectedUserIds(result);
  if (affectedUserIds !== null) invalidate(userId, affectedUserIds);
  return result;
}

export function invalidateAdminDashboard() {
  rt(TAG.ADMIN_DASHBOARD);
}

export function invalidateSettings() {
  rt(TAG.SETTINGS);
}
