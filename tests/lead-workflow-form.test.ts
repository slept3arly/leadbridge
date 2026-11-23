import assert from "node:assert/strict";
import test from "node:test";
import { followUpFormDate } from "../src/lib/follow-up-form-date";

test("follow-up date-only input keeps the API's UTC-midnight convention", () => {
  assert.equal(followUpFormDate("2035-04-12", ""), "2035-04-12");
});

test("follow-up local date and time become an ISO instant", () => {
  const localValue = "2035-04-12T09:45";
  assert.equal(followUpFormDate("2035-04-12", "09:45"), new Date(localValue).toISOString());
});

test("invalid or incomplete follow-up values are not serialized", () => {
  assert.equal(followUpFormDate("2035-02-30", ""), null);
  assert.equal(followUpFormDate("2035-04-12", "25:90"), null);
});
