import assert from "node:assert/strict";
import test from "node:test";
import { isDatabaseReady } from "../src/lib/database-readiness";

test("database readiness succeeds when the connectivity check succeeds", async () => {
  assert.equal(await isDatabaseReady(async () => undefined), true);
});

test("database readiness fails without exposing a connectivity error", async () => {
  assert.equal(
    await isDatabaseReady(async () => {
      throw new Error("private connection details");
    }),
    false,
  );
});
