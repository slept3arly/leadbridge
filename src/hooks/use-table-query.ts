"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TransitionStartFunction } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type TableQueryState = {
  search: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection: "asc" | "desc";
  filters: Record<string, string>;
  dateFrom?: string;
  dateTo?: string;
};

type NavigationMode = "push" | "replace";

export function parseTableQueryState(
  params: URLSearchParams,
  defaults: Partial<TableQueryState> = {},
): TableQueryState {
  const filters: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("filter.") && value) filters[key.slice("filter.".length)] = value;
  }

  return {
    search: params.get("search") ?? defaults.search ?? "",
    page: Number(params.get("page") ?? defaults.page ?? 1),
    pageSize: Number(params.get("pageSize") ?? defaults.pageSize ?? 25),
    sortBy: params.get("sortBy") ?? defaults.sortBy,
    sortDirection: params.get("sortDirection") === "asc" ? "asc" : (defaults.sortDirection ?? "desc"),
    filters,
    dateFrom: params.get("dateFrom") ?? defaults.dateFrom,
    dateTo: params.get("dateTo") ?? defaults.dateTo,
  };
}

export function serializeTableQuery(
  state: TableQueryState,
  currentParams: URLSearchParams = new URLSearchParams(),
): string {
  const params = new URLSearchParams(currentParams);
  for (const key of ["search", "page", "pageSize", "sortBy", "sortDirection", "dateFrom", "dateTo"]) {
    params.delete(key);
  }
  for (const key of Array.from(params.keys())) {
    if (key.startsWith("filter.")) params.delete(key);
  }

  if (state.search) params.set("search", state.search);
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.sortBy) params.set("sortBy", state.sortBy);
  params.set("sortDirection", state.sortDirection);
  Object.entries(state.filters).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, value]) => {
    if (value) params.set(`filter.${key}`, value);
  });
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  return params.toString();
}

function sameTableState(left: TableQueryState, right: TableQueryState): boolean {
  return serializeTableQuery(left) === serializeTableQuery(right);
}

export function useTableQuery(
  initial: Partial<TableQueryState> = {},
  debounceMs = 300,
  startTransition?: TransitionStartFunction,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const defaults = useRef(initial);
  const initialParams = useRef(searchParamsString);
  const initialized = useRef(false);
  const skipNavigationForState = useRef<string | null>(null);
  const navigationMode = useRef<NavigationMode>("push");
  const debounceNavigation = useRef(false);
  const [state, setState] = useState<TableQueryState>(() => {
    return parseTableQueryState(new URLSearchParams(searchParamsString), initial);
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const update = useCallback((next: Partial<TableQueryState>) => {
    const isSearchOnlyUpdate = Object.keys(next).length === 1 && Object.hasOwn(next, "search");
    navigationMode.current = isSearchOnlyUpdate ? "replace" : "push";
    debounceNavigation.current = isSearchOnlyUpdate;
    setState((current) => ({ ...current, ...next, ...(next.search === undefined ? {} : { page: 1 }) }));
  }, []);

  const queryString = useMemo(() => serializeTableQuery(state), [state]);

  useEffect(() => {
    if (!initialized.current || searchParamsString === initialParams.current) return;

    const nextState = parseTableQueryState(
      new URLSearchParams(searchParamsString),
      {
        page: 1,
        pageSize: defaults.current.pageSize ?? 25,
        sortBy: defaults.current.sortBy,
        sortDirection: defaults.current.sortDirection ?? "desc",
      },
    );
    initialParams.current = searchParamsString;

    if (!sameTableState(state, nextState)) {
      skipNavigationForState.current = serializeTableQuery(nextState);
      setState(nextState);
    }
  }, [searchParamsString, state]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    if (skipNavigationForState.current !== null) {
      if (skipNavigationForState.current === queryString) skipNavigationForState.current = null;
      return;
    }

    const currentParams = new URLSearchParams(searchParamsString);
    const targetQuery = serializeTableQuery(state, currentParams);
    if (targetQuery === searchParamsString) return;

    const mode = navigationMode.current;
    const delay = debounceNavigation.current && state.search !== "" ? debounceMs : 0;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      debounceNavigation.current = false;
      const query = targetQuery ? `?${targetQuery}` : "";
      const navigate = () => router[mode](`${window.location.pathname}${query}`, { scroll: false });
      if (startTransition) {
        startTransition(navigate);
      } else {
        navigate();
      }
    }, delay);
    return () => clearTimeout(timer.current);
  }, [debounceMs, router, queryString, searchParamsString, state, startTransition]);

  return { ...state, update, queryString };
}
