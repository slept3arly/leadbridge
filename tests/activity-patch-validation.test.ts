import test from "node:test";
import assert from "node:assert/strict";
import { validateActivityOutcomePatch } from "../src/lib/validation";

test("activity PATCH rejects action-only changes that make the stored response incompatible", () => {
  const incompatible = validateActivityOutcomePatch(
    { action: "CALL", response: "NOT_PICKED_UP", interest: null },
    { action: "WHATSAPP" },
  );
  assert.equal(incompatible?.success, false);

  const invalid = validateActivityOutcomePatch(
    { action: "CALL", response: "PICKED_UP", interest: "INTERESTED" },
    { action: "WHATSAPP" },
  );
  assert.equal(invalid?.success, false);
});

test("activity PATCH validates response-only changes against the stored action", () => {
  const valid = validateActivityOutcomePatch(
    { action: "CALL", response: "NOT_PICKED_UP", interest: null },
    { response: "INVALID_NUMBER" },
  );
  assert.equal(valid?.success, true);

  const invalid = validateActivityOutcomePatch(
    { action: "WHATSAPP", response: "NOT_REPLIED", interest: null },
    { response: "PICKED_UP" },
  );
  assert.equal(invalid?.success, false);
});

test("a successful response requires interest in the resulting state", () => {
  const missingInterest = validateActivityOutcomePatch(
    { action: "CALL", response: "NOT_PICKED_UP", interest: null },
    { response: "PICKED_UP" },
  );
  assert.equal(missingInterest?.success, false);

  const clearingRequiredInterest = validateActivityOutcomePatch(
    { action: "CALL", response: "PICKED_UP", interest: "INTERESTED" },
    { interest: null },
  );
  assert.equal(clearingRequiredInterest?.success, false);
});

test("activity PATCH accepts a valid interest update and skips outcome validation for notes-only changes", () => {
  const validInterest = validateActivityOutcomePatch(
    { action: "CALL", response: "PICKED_UP", interest: "INTERESTED" },
    { interest: "NOT_INTERESTED" },
  );
  assert.equal(validInterest?.success, true);

  const notesOnlyOnValidActivity = validateActivityOutcomePatch(
    { action: "CALL", response: "PICKED_UP", interest: "INTERESTED" },
    {},
  );
  assert.equal(notesOnlyOnValidActivity, null);

  const notesOnlyDoesNotValidateUnrelatedStoredFields = validateActivityOutcomePatch(
    { action: "WHATSAPP", response: "PICKED_UP", interest: null },
    {},
  );
  assert.equal(notesOnlyDoesNotValidateUnrelatedStoredFields, null);
});
