"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { LeadHeader } from "@/components/sales/lead-header";
import { LeadNoteComposer } from "@/components/sales/lead-note-composer";
import { LeadNoteCard } from "@/components/sales/lead-note-card";
import { StructuredActivityCard } from "@/components/sales/structured-activity-card";
import { LeadInfoSection } from "@/components/sales/lead-info-section";
import { LeadMetadataCard } from "@/components/sales/lead-metadata-card";
import { ActivityTimeline } from "@/components/sales/activity-timeline";
import { toast } from "@/lib/toast";
import { useLeadDetails, type LeadDetail } from "@/hooks/use-lead-details";

type TabId = "details" | "info" | "activity";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "info", label: "Information" },
  { id: "activity", label: "Activity" },
];

export function LeadDetailsModal({
  leadId,
  currentUserId,
  isAdmin,
  canArchive = false,
  canDelete = false,
  onClose,
  onUpdate,
}: {
  leadId: string;
  currentUserId: string;
  isAdmin: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, loading: detailsLoading, refresh, patchData } = useLeadDetails(leadId);
  const [leadDraft, setLeadDraft] = useState<LeadDetail | null>(null);

  useEffect(() => {
    setLeadDraft(data?.lead ?? null);
  }, [data?.lead, leadId]);

  // Keep the latest onClose in a ref so effects can call it without
  // making it a dependency (avoids unstable inline-arrow identity).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Scroll-lock: runs once on mount, cleans up on unmount.
  // Captures no reactive values → stable [] deps.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  // Escape key: runs once on mount, reads the ref for latest onClose.
  // Stable [] deps — the ref always holds the current callback.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  const handleFieldChange = useCallback((field: string, value: string) => {
    setLeadDraft((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!leadDraft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: leadDraft.status,
        priority: leadDraft.priority,
        category: leadDraft.category || null,
      };
      await axios.patch(`/api/leads/${leadId}`, payload);
      toast.success("Lead updated");
      // Optimistically update lead fields so the info/metadata tabs
      // reflect the new values immediately, without waiting for refresh.
      patchData((prev) => prev ? {
        ...prev,
        lead: { ...prev.lead, status: leadDraft.status, priority: leadDraft.priority, category: leadDraft.category },
      } : prev);
      refresh();
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  }, [leadDraft, leadId, onUpdate, refresh, patchData]);

  const handleToggleArchive = useCallback(async () => {
    if (!leadDraft) return;
    setArchiving(true);
    try {
      const isCurrentlyArchived = leadDraft.isArchived as boolean;
      await axios.patch(`/api/leads/${leadId}`, { isArchived: !isCurrentlyArchived });
      await refresh();
      toast.success(isCurrentlyArchived ? "Lead unarchived" : "Lead archived");
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update archive status");
    } finally {
      setArchiving(false);
    }
  }, [leadDraft, leadId, onUpdate, refresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this lead permanently? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/leads/${leadId}`);
      toast.success("Lead deleted");
      onClose();
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  }, [leadId, onClose, onUpdate]);

  const lead = leadDraft ?? data?.lead ?? null;
  const notes = data?.notes ?? [];
  const activities = data?.activities ?? [];
  const allFollowUps = data?.followUps ?? [];
  const followUpMap = new Map(allFollowUps.map((fu) => [fu.id, fu]));
  const structuredActivitiesWithFollowUp = (data?.structuredActivities ?? []).map((activity) => {
    const followUpId = activity.metadata?.followUpId;
    const followUp = typeof followUpId === "string" ? followUpMap.get(followUpId) : undefined;
    return { ...activity, followUp };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 mt-6 mb-6 w-[90%] max-w-4xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "88vh", maxHeight: "88vh" }}
      >
        {detailsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
          </div>
        ) : !lead ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
            Failed to load lead details.
          </div>
        ) : (
          <>
            <LeadHeader
              lead={lead}
              onClose={onClose}
              onChange={handleFieldChange}
              onUpdate={handleUpdate}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
              saving={saving}
              archiving={archiving}
              deleting={deleting}
              canArchive={canArchive}
              canDelete={canDelete}
            />

            <div className="flex border-b border-[var(--color-border)] bg-white">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 ${
                    activeTab === tab.id
                      ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <LeadNoteComposer
                      leadId={leadId}
                      onCreated={(activity, formMeta) => {
                        const structuredActivity = {
                          id: activity.id as string,
                          action: (formMeta.action ?? "CALL") as "CALL" | "WHATSAPP",
                          response: (formMeta.response ?? "NO_RESPONSE") as "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED",
                          interest: (formMeta.interest ?? null) as "INTERESTED" | "NOT_INTERESTED" | null,
                          message: (activity.message as string) ?? "",
                          metadata: (activity.metadata as Record<string, unknown>) ?? null,
                          createdAt: (activity.createdAt as string) ?? new Date().toISOString(),
                          actor: { id: currentUserId, name: "You" },
                          ...(formMeta.scheduleFollowUp && formMeta.followUpDate ? {
                            followUp: {
                              id: "pending",
                              title: `${formMeta.action === "CALL" ? "Call" : "WhatsApp"} follow-up`,
                              description: null,
                              dueDate: formMeta.followUpDate,
                              dueTime: formMeta.followUpTime,
                              priority: "MEDIUM",
                              status: "PENDING",
                              completedAt: null,
                              assignedUser: { id: currentUserId, name: "You" },
                              createdBy: { id: currentUserId, name: "You" },
                              createdAt: new Date().toISOString(),
                            },
                          } : {}),
                        } as import("@/hooks/use-lead-details").StructuredLeadActivity;
                        patchData((prev) => prev ? {
                          ...prev,
                          structuredActivities: [structuredActivity, ...(prev.structuredActivities ?? [])],
                        } : prev);
                        refresh();
                      }}
                    />
                  </div>
                  {structuredActivitiesWithFollowUp.map((activity) => (
                    <StructuredActivityCard
                      key={activity.id}
                      activity={activity}
                      currentUserId={currentUserId}
                      onChanged={refresh}
                    />
                  ))}
                  {notes.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)] text-center py-8">
                      No notes yet. Add your first note above.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <LeadNoteCard
                          key={note.id}
                          note={note}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          onChanged={refresh}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "info" && (
                <div className="space-y-5">
                  <LeadInfoSection lead={lead as unknown as Parameters<typeof LeadInfoSection>[0]["lead"]} />
                  <LeadMetadataCard lead={lead as unknown as Parameters<typeof LeadMetadataCard>[0]["lead"]} />
                </div>
              )}

              {activeTab === "activity" && (
                <ActivityTimeline activities={activities} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
