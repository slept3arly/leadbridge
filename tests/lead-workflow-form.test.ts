import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { followUpFormDate } from "../src/lib/follow-up-form-date";

test("filter popups ignore only clicks inside the shared Select portal", () => {
  const select = readFileSync("src/components/ui/select.tsx", "utf8");
  assert.match(select, /data-leadbridge-select-portal="true"/);

  for (const path of [
    "src/components/sales/sales-table-controls.tsx",
    "src/components/users/user-table-controls.tsx",
  ]) {
    const controls = readFileSync(path, "utf8");
    assert.match(controls, /e\.target instanceof Element && e\.target\.closest\("\[data-leadbridge-select-portal\]"\)\) return/);
    assert.match(controls, /!panelRef\.current\.contains\(e\.target as Node\)/);
    assert.match(controls, /!triggerRef\.current\.contains\(e\.target as Node\)/);
    assert.match(controls, /document\.addEventListener\("mousedown", handleClick\)/);
    assert.doesNotMatch(controls, /stopPropagation\(\)/);
  }
});

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
