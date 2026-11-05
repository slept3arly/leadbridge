"use client";

import axios from "axios";

export type CrmEntityType = "lead" | "note" | "follow-up" | "activity";

export type CrmMutationMessage = {
  eventType: "mutation";
  entityType: CrmEntityType;
  entityId?: string;
  leadId?: string;
  timestamp: number;
};

export type CrmMutationInput = Omit<CrmMutationMessage, "eventType" | "timestamp">;

export const CRM_MUTATION_ENTITY_TYPES: readonly CrmEntityType[] = ["lead", "note", "follow-up", "activity"];

const CHANNEL_NAME = "leadbridge:crm-mutations";
const STORAGE_KEY = "leadbridge:crm-mutation";
const listeners = new Set<(message: CrmMutationMessage) => void>();
let channel: BroadcastChannel | null = null;
let storageListenerAttached = false;
let axiosInterceptorId: number | null = null;
let lastLocalMutationAt = 0;

export function parseCrmMutationMessage(value: unknown): CrmMutationMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Partial<CrmMutationMessage>;
  if (
    message.eventType !== "mutation" ||
    !["lead", "note", "follow-up", "activity"].includes(message.entityType ?? "") ||
    typeof message.timestamp !== "number" || !Number.isFinite(message.timestamp) ||
    (message.entityId !== undefined && typeof message.entityId !== "string") ||
    (message.leadId !== undefined && typeof message.leadId !== "string")
  ) return null;

  return {
    eventType: "mutation",
    entityType: message.entityType as CrmEntityType,
    ...(message.entityId !== undefined ? { entityId: message.entityId } : {}),
    ...(message.leadId !== undefined ? { leadId: message.leadId } : {}),
    timestamp: message.timestamp,
  };
}

function dispatch(value: unknown) {
  const message = parseCrmMutationMessage(value);
  if (!message) return;
  for (const listener of listeners) listener(message);
}

function ensureTransport() {
  if (typeof window === "undefined") return;
  installAxiosMutationInterceptor();

  if (!channel && typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", (event: MessageEvent<unknown>) => dispatch(event.data));
    } catch {
      channel = null;
    }
  }

  if (!channel && !storageListenerAttached) {
    window.addEventListener("storage", handleStorageMessage);
    storageListenerAttached = true;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringField(value: unknown, key: string): string | undefined {
  const field = record(value)[key];
  return typeof field === "string" ? field : undefined;
}

function decodePathId(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function crmMutationFromAxiosResponse(input: {
  status?: number;
  method?: string;
  url?: string;
  data?: unknown;
}): CrmMutationInput | null {
  if (input.status !== undefined && (input.status < 200 || input.status >= 300)) return null;
  const method = input.method?.toLowerCase();
  if (!method || !["post", "put", "patch", "delete"].includes(method) || !input.url) return null;

  let pathname: string;
  try {
    pathname = new URL(input.url, "http://leadbridge.local").pathname;
  } catch {
    return null;
  }
  const data = record(input.data);

  if (pathname === "/api/leads" && method === "post") {
    const id = stringField(data, "id");
    return { entityType: "lead", ...(id ? { entityId: id } : {}) };
  }

  const nestedLead = pathname.match(/^\/api\/leads\/([^/]+)\/(assign|notes|follow-ups|activities)$/);
  if (nestedLead) {
    const leadId = decodePathId(nestedLead[1]!);
    const resource = nestedLead[2];
    if (resource === "assign" || resource === "notes" || resource === "follow-ups" || resource === "activities") {
      const entityType: CrmEntityType = resource === "notes" ? "note" : resource === "follow-ups" ? "follow-up" : resource === "activities" ? "activity" : "lead";
      return { entityType, entityId: stringField(data, "id") ?? leadId, leadId };
    }
  }

  const lead = pathname.match(/^\/api\/leads\/([^/]+)$/);
  if (lead && ["patch", "delete"].includes(method)) {
    const leadId = decodePathId(lead[1]!);
    return { entityType: "lead", entityId: leadId };
  }

  const completion = pathname.match(/^\/api\/follow-ups\/([^/]+)\/complete$/);
  if (completion && method === "post") {
    const completed = record(data.completedFollowUp);
    const id = stringField(completed, "id") ?? decodePathId(completion[1]!);
    return { entityType: "follow-up", entityId: id, ...(stringField(completed, "leadId") ? { leadId: stringField(completed, "leadId") } : {}) };
  }

  const entity = pathname.match(/^\/api\/(notes|follow-ups|activities)\/([^/]+)$/);
  if (entity) {
    const entityType: CrmEntityType = entity[1] === "notes" ? "note" : entity[1] === "follow-ups" ? "follow-up" : "activity";
    const relatedLeadId = stringField(data, "leadId") ?? stringField(data.event, "leadId");
    return {
      entityType,
      entityId: decodePathId(entity[2]!),
      ...(relatedLeadId ? { leadId: relatedLeadId } : {}),
    };
  }

  return null;
}

function installAxiosMutationInterceptor() {
  if (axiosInterceptorId !== null) return;
  axiosInterceptorId = axios.interceptors.response.use((response) => {
    const input = crmMutationFromAxiosResponse({
      status: response.status,
      method: response.config.method,
      url: response.config.url,
      data: response.data,
    });
    if (input) {
      try { publishCrmMutation(input); } catch { /* Sync notifications must never affect a completed mutation. */ }
    }
    return response;
  });
}

function handleStorageMessage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    dispatch(JSON.parse(event.newValue));
  } catch {
    // Ignore malformed storage events from other same-origin code.
  }
}

export function subscribeToCrmMutations(listener: (message: CrmMutationMessage) => void) {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  ensureTransport();

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    listeners.delete(listener);
    if (listeners.size !== 0 || typeof window === "undefined") return;

    channel?.close();
    channel = null;
    if (axiosInterceptorId !== null) {
      axios.interceptors.response.eject(axiosInterceptorId);
      axiosInterceptorId = null;
    }
    if (storageListenerAttached) {
      window.removeEventListener("storage", handleStorageMessage);
      storageListenerAttached = false;
    }
  };
}

export function publishCrmMutation(input: CrmMutationInput) {
  if (typeof window === "undefined") return;
  const message: CrmMutationMessage = {
    eventType: "mutation",
    ...input,
    timestamp: Date.now(),
  };
  lastLocalMutationAt = message.timestamp;

  if (channel) {
    channel.postMessage(message);
    return;
  }

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const publisher = new BroadcastChannel(CHANNEL_NAME);
      publisher.postMessage(message);
      publisher.close();
      return;
    } catch {
      // Fall through to the storage event transport.
    }
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Browser storage can be disabled; mutations still succeed locally.
  }
}

export function getLastLocalCrmMutationAt() {
  return lastLocalMutationAt;
}

export function createCrmMutationHandler(
  onRefresh: (message: CrmMutationMessage) => void,
  options: { entityTypes?: readonly CrmEntityType[]; leadId?: string; entityIds?: readonly string[] } = {},
) {
  const types = options.entityTypes ? new Set(options.entityTypes) : null;
  const entityIds = options.entityIds ? new Set(options.entityIds) : null;
  return (message: CrmMutationMessage) => {
    if (types && !types.has(message.entityType)) return false;
    if (options.leadId && message.leadId !== options.leadId && !(message.entityType === "lead" && message.entityId === options.leadId) && !(message.entityId && entityIds?.has(message.entityId))) return false;
    onRefresh(message);
    return true;
  };
}

export function shouldRevalidateOnVisibility(now: number, lastRefresh: number, cooldownMs = 30_000) {
  return now - lastRefresh >= cooldownMs;
}

