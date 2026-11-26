/* eslint-disable @typescript-eslint/no-require-imports -- jsdom must be installed before importing DOM-bound test helpers. */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/sales/my-leads?leadId=lead-1&custom=keep",
});
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
const { act, cleanup, render, screen, waitFor } = require("@testing-library/react") as typeof import("@testing-library/react");
const userEvent = require("@testing-library/user-event").default as typeof import("@testing-library/user-event").default;
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime") as typeof import("next/dist/shared/lib/app-router-context.shared-runtime");
const { SearchParamsContext } = require("next/dist/shared/lib/hooks-client-context.shared-runtime") as typeof import("next/dist/shared/lib/hooks-client-context.shared-runtime");
const { useTableQuery, parseTableQueryState, serializeTableQuery } = require("../src/hooks/use-table-query") as typeof import("../src/hooks/use-table-query");
const { DataTable } = require("../src/components/shared/data-table") as typeof import("../src/components/shared/data-table");
const { SalesTableControls } = require("../src/components/sales/sales-table-controls") as typeof import("../src/components/sales/sales-table-controls");
const { GoToTopButton } = require("../src/components/sales/go-to-top-button") as typeof import("../src/components/sales/go-to-top-button");

function RouterHarness({ children }: { children: React.ReactNode }) {
  const [href, setHref] = React.useState(window.location.href);

  React.useEffect(() => {
    const handlePopState = () => act(() => setHref(window.location.href));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const router = React.useMemo(() => {
    const navigate = (url: string, mode: "push" | "replace") => {
      window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
      act(() => setHref(window.location.href));
    };
    return {
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => undefined,
      push: (url: string) => navigate(url, "push"),
      replace: (url: string) => navigate(url, "replace"),
      prefetch: async () => undefined,
    };
  }, []);
  const searchParams = React.useMemo(() => new URL(href).searchParams, [href]);

  return (
    <AppRouterContext.Provider value={router as never}>
      <SearchParamsContext.Provider value={searchParams}>{children}</SearchParamsContext.Provider>
    </AppRouterContext.Provider>
  );
}

function TableQueryHarness() {
  const query = useTableQuery({ pageSize: 25, sortDirection: "desc" }, 10);
  return (
    <>
      <label>
        Search <input aria-label="Search leads" value={query.search} onChange={(event) => query.update({ search: event.target.value })} />
      </label>
      <button type="button" onClick={() => query.update({ filters: { ...query.filters, status: "NEW" }, page: 1 })}>Set status</button>
      <button type="button" onClick={() => query.update({ sortBy: "displayName", sortDirection: "asc", page: 1 })}>Sort by name</button>
      <button type="button" onClick={() => query.update({ page: query.page + 1 })}>Next page</button>
      <output aria-label="Table query state">{JSON.stringify(query)}</output>
    </>
  );
}

test("table query parsing and serialization preserve list state and unrelated parameters", () => {
  const params = new URLSearchParams("leadId=lead-1&custom=keep&search=acme&page=3&pageSize=25&sortBy=displayName&sortDirection=asc&filter.status=NEW&filter.activityDate=custom&dateFrom=2030-01-01&dateTo=2030-01-31");
  const parsed = parseTableQueryState(params, { pageSize: 25, sortDirection: "desc" });

  assert.equal(parsed.search, "acme");
  assert.equal(parsed.page, 3);
  assert.equal(parsed.sortBy, "displayName");
  assert.deepEqual(parsed.filters, { status: "NEW", activityDate: "custom" });
  assert.equal(parsed.dateFrom, "2030-01-01");
  assert.equal(parsed.dateTo, "2030-01-31");

  const serialized = new URLSearchParams(serializeTableQuery(parsed, params));
  assert.equal(serialized.get("leadId"), "lead-1");
  assert.equal(serialized.get("custom"), "keep");
  assert.equal(serialized.get("search"), "acme");
  assert.equal(serialized.get("page"), "3");
  assert.equal(serialized.get("dateFrom"), "2030-01-01");
  assert.equal(serialized.get("dateTo"), "2030-01-31");
});

test("search replaces history while committed filters, sorting, and pagination push history and resync on back/forward", async () => {
  const user = userEvent.setup();
  const initialLength = window.history.length;
  render(<RouterHarness><TableQueryHarness /></RouterHarness>);

  const search = screen.getByRole("textbox", { name: "Search leads" });
  await user.type(search, "acme");
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.get("search"), "acme"));
  assert.equal(window.history.length, initialLength);
  assert.equal(new URL(window.location.href).searchParams.get("leadId"), "lead-1");
  assert.equal(new URL(window.location.href).searchParams.get("custom"), "keep");

  await user.click(screen.getByRole("button", { name: "Set status" }));
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.get("filter.status"), "NEW"));
  await user.click(screen.getByRole("button", { name: "Sort by name" }));
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.get("sortBy"), "displayName"));
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.get("page"), "2"));

  const back = () => new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.back();
  });
  const forward = () => new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.forward();
  });

  await back();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.page, 1);
    assert.equal(state.sortBy, "displayName");
  });
  await back();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.page, 1);
    assert.equal(state.filters.status, "NEW");
    assert.equal(state.sortBy, undefined);
  });
  await back();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.search, "acme");
    assert.deepEqual(state.filters, {});
  });

  await forward();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.filters.status, "NEW");
  });
  await forward();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.sortBy, "displayName");
  });
  await forward();
  await waitFor(() => {
    const state = JSON.parse(screen.getByLabelText("Table query state").textContent ?? "{}");
    assert.equal(state.page, 2);
  });
  cleanup();
});

test("clickable table rows have a contextual name and keep nested action buttons independent", async () => {
  const user = userEvent.setup();
  let rowActivations = 0;
  let actionActivations = 0;
  render(
    <DataTable
      rows={[{ id: "lead-1", name: "Ada Example" }]}
      columns={[{
        key: "name",
        header: "Lead",
        render: (row: { id: string; name: string }) => <button type="button" onClick={(event) => { event.stopPropagation(); actionActivations += 1; }}>{row.name}</button>,
      }]}
      onRowClick={() => { rowActivations += 1; }}
      getRowAccessibleLabel={(row: { id: string; name: string }) => `Open details for ${row.name}`}
    />,
  );

  const row = screen.getByRole("row", { name: "Open details for Ada Example" });
  row.focus();
  await user.keyboard("{Enter}");
  assert.equal(rowActivations, 1);
  row.focus();
  await user.keyboard(" ");
  assert.equal(rowActivations, 2);

  await user.click(screen.getByRole("button", { name: "Ada Example" }));
  assert.equal(actionActivations, 1);
  assert.equal(rowActivations, 2);
  cleanup();
});

test("My Leads controls expose names, Radix popover state, close labeling, and independent date bounds", async () => {
  window.history.replaceState({}, "", "/sales/my-leads?leadId=lead-1&custom=keep");
  const user = userEvent.setup();
  render(
    <RouterHarness>
      <SalesTableControls
        initial={{ page: 1, pageSize: 25, sortDirection: "desc", filters: {} }}
        pagination={{ page: 1, pageSize: 25, total: 12, totalPages: 1 }}
        leadSources={[]}
      />
    </RouterHarness>,
  );

  assert.ok(screen.getByRole("textbox", { name: "Search leads" }));
  const trigger = screen.getByRole("button", { name: "Filters" });
  await user.click(trigger);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const popoverId = trigger.getAttribute("aria-controls");
  assert.ok(popoverId && document.getElementById(popoverId));

  const activityDate = screen.getByRole("combobox", { name: "Activity Date" });
  await user.click(activityDate);
  await user.click(await screen.findByRole("option", { name: "Custom" }));
  assert.equal(screen.getByLabelText("From").getAttribute("type"), "date");
  assert.equal(screen.getByLabelText("To").getAttribute("type"), "date");
  assert.ok(screen.getByRole("button", { name: "Filters, 1 active" }));

  await user.type(screen.getByLabelText("From"), "2031-02-03");
  await user.type(screen.getByLabelText("To"), "2031-02-17");
  await waitFor(() => {
    const params = new URL(window.location.href).searchParams;
    assert.equal(params.get("dateFrom"), new Date("2031-02-03T00:00:00").toISOString());
    assert.equal(params.get("dateTo"), new Date("2031-02-17T23:59:59.999").toISOString());
  });
  assert.equal((screen.getByLabelText("From") as HTMLInputElement).value, "2031-02-03");
  assert.equal((screen.getByLabelText("To") as HTMLInputElement).value, "2031-02-17");

  await user.click(screen.getByRole("button", { name: "Close filters" }));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  await user.click(trigger);

  const status = screen.getByRole("combobox", { name: "Status" });
  await user.click(status);
  await user.click(await screen.findByRole("option", { name: "New" }));
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.get("filter.status"), "NEW"));
  assert.ok(screen.getByRole("button", { name: "Filters, 4 active" }));
  await user.click(screen.getByRole("button", { name: "Remove Status: New filter" }));
  await waitFor(() => assert.equal(new URL(window.location.href).searchParams.has("filter.status"), false));

  await user.click(screen.getByRole("button", { name: "Reset" }));
  await waitFor(() => {
    const params = new URL(window.location.href).searchParams;
    assert.equal(params.has("filter.activityDate"), false);
    assert.equal(params.has("dateFrom"), false);
    assert.equal(params.has("dateTo"), false);
  });

  assert.equal(new URL(window.location.href).searchParams.get("leadId"), "lead-1");
  assert.equal(new URL(window.location.href).searchParams.get("custom"), "keep");
  cleanup();
});

test("Go to Top scrolls smoothly, supports keyboard activation, and respects reduced motion without changing URL state", async () => {
  const user = userEvent.setup();
  const originalMatchMedia = window.matchMedia;
  const originalScrollTo = window.scrollTo;
  const scrollTo = (() => undefined) as typeof window.scrollTo;
  const calls: unknown[][] = [];
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: (...args: unknown[]) => calls.push(args),
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query }),
  });
  window.history.replaceState({}, "", "/sales/my-leads?search=acme&page=3&filter.status=NEW");

  render(<GoToTopButton />);
  const button = screen.getByRole("button", { name: "Go to Top" });
  await user.click(button);
  assert.deepEqual(calls.at(-1), [{ top: 0, behavior: "smooth" }]);

  button.focus();
  await user.keyboard("{Enter}");
  assert.equal(calls.length, 2);

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("prefers-reduced-motion"), media: query }),
  });
  await user.click(button);
  assert.deepEqual(calls.at(-1), [0, 0]);
  assert.equal(window.location.search, "?search=acme&page=3&filter.status=NEW");

  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: originalScrollTo ?? scrollTo });
  cleanup();
});
