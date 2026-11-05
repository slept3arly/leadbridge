import test from "node:test";
import assert from "node:assert/strict";
import { createNoteSchema } from "../src/lib/validation";

test("note creation normalizes a valid scheduled follow-up date", () => {
  const parsed = createNoteSchema.safeParse({
    scheduleFollowUp: true,
    followUpDate: "2030-01-02",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.ok(parsed.data.followUpDate instanceof Date);
    assert.equal(parsed.data.followUpDate?.toISOString(), "2030-01-02T00:00:00.000Z");
  }
});

test("note creation rejects missing, empty, whitespace-only, and invalid scheduled dates", () => {
  for (const followUpDate of [undefined, null, "", "   ", "not-a-date", "2030-02-30"]) {
    const parsed = createNoteSchema.safeParse({ scheduleFollowUp: true, followUpDate });
    assert.equal(parsed.success, false, `expected ${JSON.stringify(followUpDate)} to be rejected`);
  }

  const missingDate = createNoteSchema.safeParse({ scheduleFollowUp: true });
  assert.equal(missingDate.success, false);
  if (!missingDate.success) {
    assert.ok(missingDate.error.issues.some((issue) => issue.path.includes("followUpDate")));
  }
});

test("note creation accepts no date or an optional date when scheduling is disabled", () => {
  const noDate = createNoteSchema.safeParse({ scheduleFollowUp: false });
  assert.equal(noDate.success, true);

  const optionalDate = createNoteSchema.safeParse({
    scheduleFollowUp: false,
    followUpDate: "2030-01-02",
  });
  assert.equal(optionalDate.success, true);
  if (optionalDate.success) {
    assert.ok(optionalDate.data.followUpDate instanceof Date);
    assert.equal(optionalDate.data.scheduleFollowUp, false);
  }
});
