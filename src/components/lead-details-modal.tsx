"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { LeadHeader } from "@/components/lead-header";
import { LeadNoteComposer } from "@/components/lead-note-composer";
import { LeadNoteCard } from "@/components/lead-note-card";
import { LeadInfoSection } from "@/components/lead-info-section";
import { LeadMetadataCard } from "@/components/lead-metadata-card";
import { ActivityTimeline } from "@/components/activity-timeline";
import { toast } from "@/lib/toast";

type TabId = "details" | "info" | "activity";

type LeadData = {
  displayName: string;
  company: string | null;
  status: string;
  priority: string;
  category?: string | null;
  isArchived?: boolean;
  [key: string]: unknown;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "info", label: "Information" },
  { id: "activity", label: "Activity" },
];

type Note = {
  id: string;
  content: string;
  whatIDid: string | null;
  whatCustomerSaid: string | null;
  createdAt: string;
  editedAt: string;
  authorId: string;
  author: { id: string; name: string };
  followUps?: Array<{ id: string; dueDate: string | null; dueTime: string | null; status: string; completedAt: string | null }>;
};

export function LeadDetailsModal({
  leadId,
  currentUserId,
  isAdmin,
  canArchive = false,
  onClose,
  onUpdate,
}: {
  leadId: string;
  currentUserId: string;
  isAdmin: boolean;
  canArchive?: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const notesFetchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`/api/leads/${leadId}`).then((res) => {
      if (cancelled) return;
      const data = res.data;
      setLead(data);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leadId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (activeTab === "details" && !notesFetchedRef.current) {
      notesFetchedRef.current = true;
      setNotesLoading(true);
      axios.get(`/api/leads/${leadId}/notes`).then((res) => {
        setNotes(res.data);
        setNotesLoading(false);
      }).catch(() => {
        setNotesLoading(false);
      });
    }
  }, [activeTab, leadId]);

  const fetchNotes = useCallback(() => {
    axios.get(`/api/leads/${leadId}/notes`).then((res) => {
      setNotes(res.data);
    });
  }, [leadId]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setLead((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: lead.status,
        priority: lead.priority,
        category: lead.category || null,
      };
      await axios.patch(`/api/leads/${leadId}`, payload);
      toast.success("Lead updated");
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  }, [lead, leadId, onUpdate]);

  const handleToggleArchive = useCallback(async () => {
    if (!lead) return;
    setArchiving(true);
    try {
      const isCurrentlyArchived = lead.isArchived as boolean;
      await axios.patch(`/api/leads/${leadId}`, { isArchived: !isCurrentlyArchived });
      setLead({ ...lead, isArchived: !isCurrentlyArchived });
      toast.success(isCurrentlyArchived ? "Lead unarchived" : "Lead archived");
      if (onUpdate) onUpdate();
    } catch {
      toast.error("Failed to update archive status");
    } finally {
      setArchiving(false);
    }
  }, [lead, leadId, onUpdate]);

  const handleNoteDeleted = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 mt-6 mb-6 w-[90%] max-w-4xl flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        style={{ height: "88vh", maxHeight: "88vh" }}
      >
        {loading ? (
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
              saving={saving}
              archiving={archiving}
              canArchive={canArchive}
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
                  <LeadNoteComposer leadId={leadId} onCreated={fetchNotes} />
                  {notesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-24 rounded-xl bg-slate-50 animate-pulse" />
                      ))}
                    </div>
                  ) : notes.length === 0 ? (
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
                          onUpdated={fetchNotes}
                          onDeleted={handleNoteDeleted}
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
                <ActivityTimeline leadId={leadId} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
