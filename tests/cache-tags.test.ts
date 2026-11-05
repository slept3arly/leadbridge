import test from "node:test";
import assert from "node:assert/strict";
import { mutationCacheTags, mutateAndInvalidate, TAG } from "../src/lib/cache-tags";

test("Admin lead mutations invalidate both previous and new Sales owner caches", () => {
  const tags = mutationCacheTags("admin-1", ["sales-a", "sales-b", "sales-a"]);

  assert.deepEqual(tags, [
    TAG.DASHBOARD("admin-1"),
    TAG.ATTENTION("admin-1"),
    TAG.DASHBOARD("sales-a"),
    TAG.ATTENTION("sales-a"),
    TAG.DASHBOARD("sales-b"),
    TAG.ATTENTION("sales-b"),
    TAG.ADMIN_DASHBOARD,
  ]);
});

test("create, update, assign, and unassign invalidation scopes include only relevant owners", () => {
  assert.deepEqual(mutationCacheTags("admin", ["sales-a"]), [
    TAG.DASHBOARD("admin"), TAG.ATTENTION("admin"),
    TAG.DASHBOARD("sales-a"), TAG.ATTENTION("sales-a"), TAG.ADMIN_DASHBOARD,
  ]);
  assert.deepEqual(mutationCacheTags("admin", ["sales-a", "sales-b"]), [
    TAG.DASHBOARD("admin"), TAG.ATTENTION("admin"),
    TAG.DASHBOARD("sales-a"), TAG.ATTENTION("sales-a"),
    TAG.DASHBOARD("sales-b"), TAG.ATTENTION("sales-b"), TAG.ADMIN_DASHBOARD,
  ]);
  assert.deepEqual(mutationCacheTags("admin", [null, undefined, "sales-a"]), [
    TAG.DASHBOARD("admin"), TAG.ATTENTION("admin"),
    TAG.DASHBOARD("sales-a"), TAG.ATTENTION("sales-a"), TAG.ADMIN_DASHBOARD,
  ]);
  assert.equal(mutationCacheTags("admin", ["sales-a"]).includes(TAG.DASHBOARD("sales-unaffected")), false);
});

test("mutation invalidation runs only after successful writes and can skip no-op results", async () => {
  const invalidations: Array<{ userId: string; affectedUserIds?: readonly (string | null | undefined)[] }> = [];
  const invalidate = (userId: string, affectedUserIds?: readonly (string | null | undefined)[]) => {
    invalidations.push({ userId, affectedUserIds });
  };

  await assert.rejects(
    mutateAndInvalidate("admin", async () => { throw new Error("database write failed"); }, () => ["sales-a"], invalidate),
    /database write failed/,
  );
  assert.equal(invalidations.length, 0);

  const skipped = await mutateAndInvalidate("admin", async () => "duplicate", () => null, invalidate);
  assert.equal(skipped, "duplicate");
  assert.equal(invalidations.length, 0);

  const created = await mutateAndInvalidate("admin", async () => "created", () => ["sales-a"], invalidate);
  assert.equal(created, "created");
  assert.deepEqual(invalidations, [{ userId: "admin", affectedUserIds: ["sales-a"] }]);
});
