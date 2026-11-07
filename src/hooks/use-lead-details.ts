"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useCrmSync } from "@/hooks/use-crm-sync";
import { CRM_MUTATION_ENTITY_TYPES } from "@/lib/crm-sync";

const inFlightLeadDetails = new Map<string, Promise<LeadDetails>>();

function fetchLeadDetails(leadId: string, force = false): Promise<LeadDetails> {
  const existing = inFlightLeadDetails.get(leadId);
  if (existing && !force) return existing;
  if (force) inFlightLeadDetails.delete(leadId);

  const request = axios.get<LeadDetails>(`/api/leads/${leadId}/details`).then((response) => response.data);
  inFlightLeadDetails.set(leadId, request);
  const clearRequest = () => {
    if (inFlightLeadDetails.get(leadId) === request) inFlightLeadDetails.delete(leadId);
  };
  request.then(clearRequest, clearRequest);
  return request;
}

export type LeadDetail = {
  id: string;
  leadNumber: string;
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  website: string | null;
  jobTitle: string | null;
  budget: unknown;
  expectedValue: unknown;
  currency: string | null;
  requirement: string | null;
  status: string;
  priority: string;
  category?: string | null;
  isArchived?: boolean;
  assignedUser: { id: string; name: string } | null;
  firstContactedAt: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  closedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
  importedAt: string | null;
  sourceName: string | null;
  source: { id: string; name: string; sourceType: string } | null;
  [key: string]: unknown;
};

export type LeadNoteFollowUp = {
  id: string;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  completedAt: string | null;
};

export type LeadNote = {
  id: string;
  content: string;
  whatIDid: string | null;
  whatCustomerSaid: string | null;
  createdAt: string;
  editedAt: string;
  authorId: string;
  author: { id: string; name: string };
  followUps?: LeadNoteFollowUp[];
};

export type LeadFollowUp = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
  noteId: string | null;
  assignedUser: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
};

export type ActivityEventEntry = {
  id: string;
  type: string;
  action: "CALL" | "WHATSAPP" | null;
  response: "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED" | null;
  interest: "INTERESTED" | "NOT_INTERESTED" | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  followUpId: string | null;
  followUp: {
    id: string;
    title: string;
    dueDate: string | null;
    dueTime: string | null;
    status: string;
    completedAt: string | null;
  } | null;
  createdAt: string;
};

export type ActivityEventItem = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
  entries: ActivityEventEntry[];
};

export type LeadDetails = {
  lead: LeadDetail;
  notes: LeadNote[];
  followUps: LeadFollowUp[];
  activityEvents: ActivityEventItem[];
};

export function useLeadDetails(leadId: string) {
  const [data, setData] = useState<LeadDetails | null>(null);
  const [loadedLeadId, setLoadedLeadId] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const loading = loadedLeadId !== leadId;

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      const details = await fetchLeadDetails(leadId, true);
      if (requestSequence.current === requestId) setData(details);
    } catch (error) {
      if (requestSequence.current === requestId && axios.isAxiosError(error) && error.response?.status === 404) setData(null);
      throw error;
    }
  }, [leadId]);

  const relatedEntityIds = data ? [
    ...data.notes.map((note) => note.id),
    ...data.followUps.map((followUp) => followUp.id),
    ...data.activityEvents.flatMap((event) => [event.id, ...event.entries.map((entry) => entry.id)]),
  ] : [];
  useCrmSync({ entityTypes: CRM_MUTATION_ENTITY_TYPES, leadId, entityIds: relatedEntityIds, onRefresh: refresh });

  const patchData = useCallback((patch: Partial<LeadDetails> | ((prev: LeadDetails | null) => LeadDetails | null)) => {
    if (typeof patch === "function") {
      setData(patch);
    } else {
      setData((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestSequence.current;
    fetchLeadDetails(leadId)
      .then((details) => {
        if (!cancelled && requestSequence.current === requestId) {
          setData(details);
          setLoadedLeadId(leadId);
        }
      })
      .catch(() => {
        if (!cancelled && requestSequence.current === requestId) {
          setData(null);
          setLoadedLeadId(leadId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return { data, loading, refresh, setData, patchData };
}
