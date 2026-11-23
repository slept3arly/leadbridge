/* eslint-disable @typescript-eslint/no-require-imports -- jsdom must be installed before importing DOM-bound test helpers. */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Document: dom.window.Document,
  DocumentFragment: dom.window.DocumentFragment,
  HTMLFormElement: dom.window.HTMLFormElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  Event: dom.window.Event,
  CustomEvent: dom.window.CustomEvent,
  MouseEvent: dom.window.MouseEvent,
  KeyboardEvent: dom.window.KeyboardEvent,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  MutationObserver: dom.window.MutationObserver,
  PointerEvent: dom.window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
Object.assign(dom.window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
});
if (!dom.window.requestAnimationFrame) {
  dom.window.requestAnimationFrame = (callback) => dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
}
if (!dom.window.ResizeObserver) {
  dom.window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const React = require("react") as typeof import("react");
const { cleanup, render, screen } = require("@testing-library/react") as typeof import("@testing-library/react");
const userEvent = require("@testing-library/user-event").default as typeof import("@testing-library/user-event").default;
const { FilterPopover } = require("../src/components/ui/filter-popover") as typeof import("../src/components/ui/filter-popover");
const { Select } = require("../src/components/ui/select") as typeof import("../src/components/ui/select");

function FilterPopupHarness() {
  const [open, setOpen] = React.useState(false);
  const [firstValue, setFirstValue] = React.useState("");
  const [secondValue, setSecondValue] = React.useState("");
  return (
    <>
      <FilterPopover open={open} onOpenChange={setOpen} trigger={<button type="button">Filters</button>}>
        <section aria-label="Filters popup" data-testid="filters-popup">
          <Select aria-label="First filter" value={firstValue} onChange={(event) => setFirstValue(event.target.value)}>
            <option value="">Choose first</option>
            <option value="first-option">First option</option>
          </Select>
          <Select aria-label="Second filter" value={secondValue} onChange={(event) => setSecondValue(event.target.value)}>
            <option value="">Choose second</option>
            <option value="second-option">Second option</option>
          </Select>
          <label><input aria-label="Enabled" type="checkbox" /> Enabled</label>
          <input aria-label="Date" type="text" />
          <div data-testid="popup-empty-space">Empty space</div>
          <output aria-label="Selected filters">{[firstValue, secondValue].filter(Boolean).join(",")}</output>
        </section>
      </FilterPopover>
      <button type="button">Outside</button>
    </>
  );
}

test("filter popup stays open for internal controls and Select portal interactions", async () => {
  const user = userEvent.setup();
  render(<FilterPopupHarness />);
  const trigger = screen.getByRole("button", { name: "Filters" });
  const openPopup = async () => {
    if (!screen.queryByTestId("filters-popup")) await user.click(trigger);
    assert.ok(screen.getByTestId("filters-popup"));
  };

  await openPopup();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const popupId = trigger.getAttribute("aria-controls");
  assert.ok(popupId);
  assert.ok(document.getElementById(popupId)?.contains(screen.getByTestId("filters-popup")));
  let firstFilterTrigger = screen.getByRole("combobox", { name: "First filter" });
  const secondFilterTrigger = screen.getByRole("combobox", { name: "Second filter" });
  await user.click(firstFilterTrigger);
  assert.ok(await screen.findByRole("listbox"));
  // Reproduce the reported failure: open a dropdown, then click elsewhere in
  // the popup and assert its visible content stays mounted.
  await user.click(secondFilterTrigger);
  assert.ok(screen.getByTestId("filters-popup"));
  assert.equal(secondFilterTrigger.getAttribute("aria-expanded"), "true");
  assert.ok(await screen.findByRole("listbox"));
  await user.click(screen.getByTestId("popup-empty-space"));
  assert.ok(screen.getByTestId("filters-popup"));
  assert.equal(screen.queryByRole("listbox"), null);

  await user.click(firstFilterTrigger);
  await user.click(await screen.findByRole("option", { name: "First option" }));
  assert.ok(screen.getByTestId("filters-popup"));
  assert.equal(screen.getByLabelText("Selected filters").textContent, "first-option");
  assert.equal(document.activeElement, firstFilterTrigger);

  await user.click(secondFilterTrigger);
  await user.click(await screen.findByRole("option", { name: "Second option" }));
  assert.ok(screen.getByTestId("filters-popup"));
  assert.equal(screen.getByLabelText("Selected filters").textContent, "first-option,second-option");

  await user.click(screen.getByRole("checkbox", { name: "Enabled" }));
  await user.type(screen.getByRole("textbox", { name: "Date" }), "2030-01-02");
  assert.ok(screen.getByTestId("filters-popup"));
  await user.click(trigger);
  assert.equal(screen.queryByTestId("filters-popup"), null);

  await openPopup();
  assert.equal(screen.getByLabelText("Selected filters").textContent, "first-option,second-option");
  firstFilterTrigger = screen.getByRole("combobox", { name: "First filter" });
  await user.click(firstFilterTrigger);
  assert.ok(await screen.findByRole("listbox"));
  await user.keyboard("{ArrowDown}");
  assert.ok(screen.getByRole("listbox"));
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("listbox"), null);
  assert.ok(screen.getByTestId("filters-popup"));
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByTestId("filters-popup"), null);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, trigger);

  await openPopup();
  await user.click(screen.getByRole("button", { name: "Outside" }));
  assert.equal(screen.queryByTestId("filters-popup"), null);
  cleanup();
});
