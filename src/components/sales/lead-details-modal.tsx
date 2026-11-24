"use client";

import { useState, useCallback, useMemo, useRef, useEffect, type CSSProperties } from "react";
import axios from "axios";
import { LeadHeader } from "@/components/sales/lead-header";
import type { LeadInfoSection } from "@/components/sales/lead-info-section";
import { LeadDetailsPopup } from "@/components/sales/lead-details-popup";
import { DailyHistory } from "@/components/sales/daily-history";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { useLeadDetails, type LeadFollowUp, type ActivityEventItem } from "@/hooks/use-lead-details";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { RecordProgressForm } from "@/components/leads/record-progress-form";
import { LeadEditModal } from "@/components/leads/lead-edit-modal";
import { formatDate, formatTime } from "@/lib/utils";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { followUpFormDate } from "@/lib/follow-up-form-date";
import { buildLeadWorkspaceTimeline, organizeLeadWorkspaceFollowUps } from "@/lib/lead-workspace";
import { ACTIVITY_ACTION_OPTIONS, getActivityResponseOptions, getActivityResponseLabel } from "@/lib/activity-options";
import { ACTIVITY_REASON_OPTIONS } from "@/lib/activity-reasons";

function isResponded(response: string) {
  return response === "PICKED_UP" || response === "REPLIED";
}

function useModalState(open: boolean, onClose: () => void, canClose = true) {
  return useAccessibleDialog<HTMLDivElement>({ open, onClose, canClose });
}

function ScheduleFollowUpModal({
  open,
  leadId,
  onClose,
  onSaved,
  onRecordProgress,
}: {
  open: boolean;
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
  onRecordProgress: (date: string, time: string) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalState(open, onClose, !saving);

  const canSubmit = Boolean(date && followUpFormDate(date, time));

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const dueDate = followUpFormDate(date, time);
      if (!dueDate) throw new Error("Enter a valid due date.");
      await axios.post(`/api/leads/${leadId}/follow-ups`, {
        title: "Follow-up",
        dueDate,
        dueTime: time || null,
        leadId,
      });

      toast.success("Follow-up scheduled");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to schedule follow-up";
      setError(typeof message === "string" ? message : "Failed to schedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-label="Schedule follow-up" tabIndex={-1} className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Schedule Follow-up</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="schedule-follow-up-date" className="text-xs font-medium text-[var(--color-muted)]">Date</label>
              <Input id="schedule-follow-up-date" data-autofocus type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="schedule-follow-up-time" className="text-xs font-medium text-[var(--color-muted)]">Time</label>
              <Input id="schedule-follow-up-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Need to log a customer interaction too? <button type="button" onClick={() => onRecordProgress(date, time)} className="font-semibold underline underline-offset-2">Use Log Activity</button> to record it and schedule a follow-up together.
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="black" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  open,
  followUp,
  onClose,
  onSaved,
}: {
  open: boolean;
  followUp: { id: string; dueDate: string | null; dueTime: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(() => followUp?.dueDate ? (() => { const d = new Date(followUp.dueDate!); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : "");
  const [time, setTime] = useState(followUp?.dueTime ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalState(open, onClose, !saving);

  async function handleSave() {
    if (!date || !followUp) return;
    setSaving(true);
    setError(null);
    try {
      const localStr = time ? `${date}T${time}` : `${date}T00:00`;
      const dueDate = new Date(localStr).toISOString();
      await axios.patch(`/api/follow-ups/${followUp.id}`, { dueDate, dueTime: time || null });
      toast.success("Follow-up rescheduled");
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to reschedule follow-up";
      setError(typeof message === "string" ? message : "Failed to reschedule follow-up");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !followUp) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-label="Reschedule follow-up" tabIndex={-1} className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl border border-[var(--color-border)]">
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Reschedule Follow-up</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="reschedule-follow-up-date" className="text-xs font-medium text-[var(--color-muted)]">Date</label>
              <Input id="reschedule-follow-up-date" data-autofocus type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="reschedule-follow-up-time" className="text-xs font-medium text-[var(--color-muted)]">Time</label>
              <Input id="reschedule-follow-up-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="black" onClick={handleSave} disabled={!date || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditActivityModal({
  open,
  activity,
  onClose,
  onSave,
}: {
  open: boolean;
  activity: ActivityEventItem | null;
  onClose: () => void;
  onSave: (id: string, data: { action: string; response: string; interest: string | null; reason: string | null; notes: string | null }) => Promise<void>;
}) {
  const entry = activity?.entries.find((e) => e.action);
  const [action, setAction] = useState<string>(entry?.action ?? "CALL");
  const [response, setResponse] = useState(entry?.response ?? "");
  const [interest, setInterest] = useState(entry?.interest ?? "");
  const [reason, setReason] = useState(entry?.reason ?? "");
  const [notes, setNotes] = useState(entry?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalState(open, onClose, !saving);

  const interestVisible = isResponded(response);
  const canSubmit = response && (!interestVisible || interest) && (interest !== "NOT_INTERESTED" || reason);

  async function handleSave() {
    if (!canSubmit || !entry) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(entry.id, {
        action,
        response,
        interest: interestVisible ? interest : null,
        reason: interest === "NOT_INTERESTED" ? reason || null : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update activity";
      setError(typeof message === "string" ? message : "Failed to update activity");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !entry) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div ref={dialogRef} data-accessible-dialog role="dialog" aria-modal="true" aria-label="Edit activity" tabIndex={-1} className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[var(--color-border)] max-h-[85vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Edit Activity</h2>
          <div className="space-y-2">
            <label htmlFor="edit-activity-action" className="text-sm font-medium text-[var(--color-ink)]">Action</label>
            <Select id="edit-activity-action" data-autofocus value={action} onChange={(e) => { setAction(e.target.value); setResponse(""); }}>
              {ACTIVITY_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-activity-response" className="text-sm font-medium text-[var(--color-ink)]">Response</label>
            <Select id="edit-activity-response" value={response} onChange={(e) => setResponse(e.target.value)}>
              <option value="">Select response</option>
              {response === "NO_RESPONSE" && <option value="NO_RESPONSE">{getActivityResponseLabel("NO_RESPONSE")} (historical)</option>}
              {getActivityResponseOptions(action).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit-activity-interest" className="text-sm font-medium text-[var(--color-ink)]">Interest</label>
              <Select id="edit-activity-interest" value={interest} disabled={!interestVisible} onChange={(e) => setInterest(e.target.value)}>
                <option value="">Select interest</option>
                <option value="INTERESTED">Interested</option>
                <option value="NOT_INTERESTED">Not Interested</option>
              </Select>
            </div>
            <div className="space-y-2"><label htmlFor="edit-activity-reason" className="text-sm font-medium text-[var(--color-ink)]">Reason</label><Select id="edit-activity-reason" value={reason} disabled={interest !== "NOT_INTERESTED"} onChange={(e) => setReason(e.target.value)}><option value="">Select reason</option>{ACTIVITY_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-activity-notes" className="text-sm font-medium text-[var(--color-ink)]">Notes</label>
            <Textarea id="edit-activity-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add a note about the interaction" className="resize-none" />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="black" onClick={handleSave} disabled={!canSubmit || saving}>
            {saving ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving...</span> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpsColumn({
  followUps,
  currentUserId,
  onComplete,
  onReschedule,
  onDelete,
}: {
  followUps: LeadFollowUp[];
  currentUserId: string;
  onComplete: (id: string) => void;
  onReschedule: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { pending, completed, overdueIds } = useMemo(() => organizeLeadWorkspaceFollowUps(followUps), [followUps]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white" aria-labelledby="workspace-follow-ups-title">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <h3 id="workspace-follow-ups-title" className="text-sm font-semibold text-[var(--color-ink)]">Follow-ups</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{pending.length ? `${pending.length} pending` : "No pending tasks"}</p>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {pending.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-[var(--color-muted)]">Nothing is waiting on this lead.</div>
        ) : pending.map((followUp, index) => {
          const overdue = overdueIds.has(followUp.id);
          return (
            <article key={followUp.id} className={`rounded-xl border p-3 ${overdue ? "border-red-200 bg-red-50/60" : "border-[var(--color-border)] bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {index === 0 && <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand)]">Next action</span>}
                  <h4 className="break-words text-sm font-semibold text-[var(--color-ink)]">{followUp.title}</h4>
                  <p className={`mt-1 text-xs ${overdue ? "font-semibold text-red-700" : "text-[var(--color-muted)]"}`}>
                    {followUp.dueDate ? `${formatDate(followUp.dueDate, "-")}${followUp.dueTime ? ` · ${formatTime(followUp.dueTime)}` : ""}` : "No due date"}
                  </p>
                  {followUp.assignedUser && <p className="mt-1 text-xs text-[var(--color-muted)]">Owner: {followUp.assignedUser.name}</p>}
                </div>
                {overdue && <Badge label="Overdue" toneKey="URGENT" className="shrink-0" />}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onComplete(followUp.id)}><CheckCircle2 size={13} />Log Activity</Button>
                <IconActionButton icon={RotateCcw} label={`Reschedule ${followUp.title}`} onClick={() => onReschedule(followUp.id)} className="h-8 w-8" />
                {followUp.createdBy.id === currentUserId && <IconActionButton icon={Trash2} label={`Delete ${followUp.title}`} onClick={() => onDelete(followUp.id)} className="h-8 w-8" />}
              </div>
            </article>
          );
        })}

        {completed.length > 0 && (
          <details className="rounded-xl border border-[var(--color-border)] px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-medium text-[var(--color-ink)]">Completed follow-ups <span className="text-[var(--color-muted)]">({completed.length})</span></summary>
            <ul className="mt-3 space-y-2">
              {completed.slice(0, 3).map((item) => <li key={item.id} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words text-[var(--color-ink)]">{item.title}</span><span className="shrink-0 text-xs text-[var(--color-muted)]">{item.completedAt ? formatDate(item.completedAt) : "Completed"}</span></li>)}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

export function LeadDetailsModal({
  leadId,
  currentUserId,
  isAdmin,
  canArchive = false,
  canDelete = false,
  leadSources,
  onClose,
  onUpdate,
}: {
  leadId: string;
  currentUserId: string;
  isAdmin: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
  leadSources?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const { data, loading: detailsLoading, refresh } = useLeadDetails(leadId);
  const leadDraft = data?.lead ?? null;

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"history" | "activity">("history");
  const [historyPanelSplit, setHistoryPanelSplit] = useState(70);
  const workspaceTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const workspaceGridRef = useRef<HTMLDivElement | null>(null);
  const resizeSeparatorRef = useRef<HTMLDivElement | null>(null);
  const splitRef = useRef(70);
  const dragRef = useRef<{ offset: number; userSelect: string; cursor: string } | null>(null);
  const [scheduleFollowUpOpen, setScheduleFollowUpOpen] = useState(false);
  const [progressScheduleDraft, setProgressScheduleDraft] = useState<{ date: string; time: string } | null>(null);
  const [editActivity, setEditActivity] = useState<ActivityEventItem | null>(null);
  const [rescheduleFollowUp, setRescheduleFollowUp] = useState<{ id: string; dueDate: string | null; dueTime: string | null } | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [editLeadOpen, setEditLeadOpen] = useState(false);

  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<string | null>(null);
  const [deletingFollowUp, setDeletingFollowUp] = useState(false);
  const [deleteFollowUpError, setDeleteFollowUpError] = useState<string | null>(null);

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archivingConfirm, setArchivingConfirm] = useState(false);
  const [archiveConfirmError, setArchiveConfirmError] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [deleteConfirmError, setDeleteConfirmError] = useState<string | null>(null);

  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: true, onClose });

  const applyHistoryPanelSplit = useCallback((requestedSplit: number) => {
    const split = Math.max(30, Math.min(70, requestedSplit));
    splitRef.current = split;
    workspaceGridRef.current?.style.setProperty(
      "--workspace-grid-columns",
      `minmax(0, ${split}fr) 12px minmax(0, ${100 - split}fr)`,
    );
    return split;
  }, []);

  const restoreDividerDragStyles = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    document.body.style.userSelect = drag.userSelect;
    document.body.style.cursor = drag.cursor;
    dragRef.current = null;
  }, []);

  const handleDividerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || !workspaceGridRef.current || !resizeSeparatorRef.current) return;
    const gridRect = workspaceGridRef.current.getBoundingClientRect();
    const separatorRect = resizeSeparatorRef.current.getBoundingClientRect();
    const leftWidth = (gridRect.width - separatorRect.width) * splitRef.current / 100;
    dragRef.current = {
      offset: event.clientX - (gridRect.left + leftWidth),
      userSelect: document.body.style.userSelect,
      cursor: document.body.style.cursor,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    event.preventDefault();
  }, []);

  const handleDividerPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const grid = workspaceGridRef.current;
    const separator = resizeSeparatorRef.current;
    if (!drag || !grid || !separator) return;
    const gridRect = grid.getBoundingClientRect();
    const availableWidth = gridRect.width - separator.getBoundingClientRect().width;
    if (availableWidth <= 0) return;
    const leftWidth = event.clientX - gridRect.left - drag.offset;
    applyHistoryPanelSplit(leftWidth / availableWidth * 100);
  }, [applyHistoryPanelSplit]);

  const finishDividerDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    restoreDividerDragStyles();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setHistoryPanelSplit(splitRef.current);
  }, [restoreDividerDragStyles]);

  const handleDividerKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextSplit = splitRef.current;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextSplit -= 2;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") nextSplit += 2;
    else if (event.key === "Home") nextSplit = 30;
    else if (event.key === "End") nextSplit = 70;
    else return;
    event.preventDefault();
    setHistoryPanelSplit(applyHistoryPanelSplit(nextSplit));
  }, [applyHistoryPanelSplit]);

  useEffect(() => () => restoreDividerDragStyles(), [restoreDividerDragStyles]);

  const focusActivityForm = useCallback(() => {
    setActiveWorkspaceTab("activity");
    requestAnimationFrame(() => document.getElementById("record-progress-action")?.focus());
  }, []);

  const handleWorkspaceTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % 2
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + 1) % 2
        : event.key === "Home" ? 0
          : event.key === "End" ? 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    setActiveWorkspaceTab(nextIndex === 0 ? "history" : "activity");
    workspaceTabRefs.current[nextIndex]?.focus();
  }, []);

  const handleToggleArchive = useCallback(() => {
    setArchiveConfirmError(null);
    setArchiveConfirmOpen(true);
  }, []);

  const confirmArchive = useCallback(async () => {
    if (!leadDraft) return;
    setArchivingConfirm(true);
    setArchiveConfirmError(null);
    try {
      const isCurrentlyArchived = leadDraft.isArchived as boolean;
      await axios.patch(`/api/leads/${leadId}`, { isArchived: !isCurrentlyArchived });
      await refresh();
      toast.success(isCurrentlyArchived ? "Lead unarchived" : "Lead archived");
      setArchiveConfirmOpen(false);
      if (onUpdate) onUpdate();
    } catch {
      setArchiveConfirmError("Failed to update archive status. Please try again.");
    } finally {
      setArchivingConfirm(false);
    }
  }, [leadDraft, leadId, onUpdate, refresh]);

  const handleDelete = useCallback(() => {
    setDeleteConfirmError(null);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeletingConfirm(true);
    setDeleteConfirmError(null);
    try {
      await axios.delete(`/api/leads/${leadId}`);
      toast.success("Lead deleted");
      setDeleteConfirmOpen(false);
      onClose();
      if (onUpdate) onUpdate();
    } catch {
      setDeleteConfirmError("Failed to delete lead. Please try again.");
    } finally {
      setDeletingConfirm(false);
    }
  }, [leadId, onClose, onUpdate]);

  const handleEditActivity = useCallback(async (id: string, data: { action: string; response: string; interest: string | null; reason: string | null; notes: string | null }) => {
    await axios.patch(`/api/activities/${id}`, data);
    toast.success("Activity updated");
    refresh();
  }, [refresh]);

  const handleDeleteFollowUp = useCallback((id: string) => {
    setDeleteFollowUpError(null);
    setDeleteFollowUpTarget(id);
  }, []);

  const confirmDeleteFollowUp = useCallback(async () => {
    if (!deleteFollowUpTarget) return;
    setDeletingFollowUp(true);
    setDeleteFollowUpError(null);
    try {
      await axios.delete(`/api/follow-ups/${deleteFollowUpTarget}`);
      toast.success("Follow-up deleted");
      setDeleteFollowUpTarget(null);
      refresh();
    } catch {
      setDeleteFollowUpError("Failed to delete follow-up. Please try again.");
    } finally {
      setDeletingFollowUp(false);
    }
  }, [deleteFollowUpTarget, refresh]);

  const lead = leadDraft ?? data?.lead ?? null;
  const activityEvents = data?.activityEvents ?? [];
  const allFollowUps = data?.followUps ?? [];
  const workspaceEvents = useMemo(
    () => buildLeadWorkspaceTimeline(data?.activityEvents ?? [], data?.notes ?? []),
    [data?.activityEvents, data?.notes],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        data-accessible-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-workspace-title"
        tabIndex={-1}
        className="relative z-10 flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl"
      >
        {detailsLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
          </div>
        ) : !lead ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--color-muted)]">Failed to load lead details.</div>
        ) : (
          <>
            <LeadHeader
              lead={lead}
              onClose={onClose}
              onViewDetails={() => setViewDetailsOpen(true)}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
              archiving={archivingConfirm}
              deleting={deletingConfirm}
              canArchive={canArchive}
              canDelete={canDelete}
            />

            <div role="tablist" aria-label="Lead workspace panels" className="grid shrink-0 grid-cols-2 border-b border-[var(--color-border)] bg-white lg:hidden">
              {(["history", "activity"] as const).map((tab, index) => (
                <button
                  key={tab}
                  ref={(element) => { workspaceTabRefs.current[index] = element; }}
                  id={`workspace-${tab}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={activeWorkspaceTab === tab}
                  aria-controls={`workspace-${tab}-panel`}
                  tabIndex={activeWorkspaceTab === tab ? 0 : -1}
                  onClick={() => setActiveWorkspaceTab(tab)}
                  onKeyDown={(event) => handleWorkspaceTabKeyDown(event, index)}
                  className={`min-h-12 border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)] ${activeWorkspaceTab === tab ? "border-[var(--color-brand)] text-[var(--color-brand)]" : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}
                >
                  {tab === "history" ? "History" : "Log Activity"}
                </button>
              ))}
            </div>

            <div
              ref={workspaceGridRef}
              className="grid min-h-0 flex-1 min-w-0 grid-cols-1 lg:grid-cols-[var(--workspace-grid-columns)]"
              style={{
                "--workspace-grid-columns": `minmax(0, ${historyPanelSplit}fr) 12px minmax(0, ${100 - historyPanelSplit}fr)`,
              } as CSSProperties}
            >
                <section
                  id="workspace-history-panel"
                  role="tabpanel"
                  aria-labelledby="workspace-history-title"
                  className={`${activeWorkspaceTab === "history" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden lg:flex lg:border-r lg:border-[var(--color-border)]`}
                >
                  <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] bg-white/95 px-5 backdrop-blur sm:px-6">
                    <h3 id="workspace-history-title" className="text-base leading-6 font-semibold text-[var(--color-ink)]">Activity &amp; History</h3>
                  </header>
                  <div tabIndex={0} className="workspace-panel-scroll min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--color-panel)] px-5 py-5 sm:px-6 sm:py-6">
                    <DailyHistory
                      activityEvents={workspaceEvents}
                      onEditActivity={!isAdmin ? (id) => {
                        const event = activityEvents.find((item) => item.entries.some((entry) => entry.id === id));
                        if (event) setEditActivity(event);
                      } : undefined}
                    />
                  </div>
                </section>

                <div
                  ref={resizeSeparatorRef}
                  role="separator"
                  aria-label="Resize Activity & History and Log Activity panels"
                  aria-orientation="vertical"
                  aria-controls="workspace-history-panel workspace-activity-panel"
                  aria-valuemin={30}
                  aria-valuemax={70}
                  aria-valuenow={Math.round(historyPanelSplit)}
                  aria-valuetext={`${Math.round(historyPanelSplit)}% Activity & History, ${100 - Math.round(historyPanelSplit)}% Log Activity`}
                  tabIndex={0}
                  onPointerDown={handleDividerPointerDown}
                  onPointerMove={handleDividerPointerMove}
                  onPointerUp={finishDividerDrag}
                  onPointerCancel={finishDividerDrag}
                  onKeyDown={handleDividerKeyDown}
                  className="group hidden cursor-col-resize touch-none select-none items-center justify-center outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand)] lg:flex"
                >
                  <span className="h-12 w-1 rounded-full bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-brand)] group-focus-visible:bg-[var(--color-brand)]" aria-hidden="true" />
                </div>

                <section
                  id="workspace-activity-panel"
                  role="tabpanel"
                  aria-labelledby="workspace-activity-title"
                  tabIndex={0}
                  className={`${activeWorkspaceTab === "activity" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col overflow-hidden bg-white lg:flex`}
                >
                  <RecordProgressForm
                    key={`embedded-progress:${leadId}`}
                    mode="embedded"
                    leadId={leadId}
                    lead={leadDraft}
                    pendingFollowUps={allFollowUps}
                    initialFollowUpSchedule={progressScheduleDraft}
                    followUpManagement={
                      <FollowUpsColumn
                        followUps={allFollowUps}
                        currentUserId={currentUserId}
                        onComplete={focusActivityForm}
                        onReschedule={(id) => {
                          const fu = allFollowUps.find((item) => item.id === id);
                          if (fu) setRescheduleFollowUp({ id: fu.id, dueDate: fu.dueDate, dueTime: fu.dueTime });
                        }}
                        onDelete={handleDeleteFollowUp}
                      />
                    }
                    onSaved={async () => {
                      await refresh();
                      setProgressScheduleDraft(null);
                      if (onUpdate) onUpdate();
                    }}
                  />
                </section>
            </div>
          </>
        )}
      </div>

      <ScheduleFollowUpModal
        key={`lead:${leadId}:schedule-follow-up:${scheduleFollowUpOpen ? "open" : "closed"}`}
        open={scheduleFollowUpOpen}
        leadId={leadId}
        onClose={() => setScheduleFollowUpOpen(false)}
        onSaved={refresh}
        onRecordProgress={(date, time) => { setScheduleFollowUpOpen(false); setProgressScheduleDraft({ date, time }); focusActivityForm(); }}
      />


      <EditActivityModal
        key={`lead:${leadId}:edit-activity:${editActivity?.id ?? "none"}:${editActivity ? "open" : "closed"}`}
        open={!!editActivity}
        activity={editActivity}
        onClose={() => setEditActivity(null)}
        onSave={handleEditActivity}
      />

      <RescheduleModal
        key={`lead:${leadId}:reschedule-follow-up:${rescheduleFollowUp?.id ?? "none"}:${rescheduleFollowUp ? "open" : "closed"}`}
        open={!!rescheduleFollowUp}
        followUp={rescheduleFollowUp}
        onClose={() => setRescheduleFollowUp(null)}
        onSaved={refresh}
      />

      {lead && <LeadDetailsPopup
        open={viewDetailsOpen}
        lead={lead as unknown as Parameters<typeof LeadInfoSection>[0]["lead"]}
        onClose={() => setViewDetailsOpen(false)}
        onEdit={() => { setViewDetailsOpen(false); setEditLeadOpen(true); }}
      />}

      {lead && (
        <LeadEditModal
          open={editLeadOpen}
          onClose={() => setEditLeadOpen(false)}
          onSaved={refresh}
          lead={{
            id: lead.id,
            name: lead.displayName,
            company: lead.company as string | null,
            email: lead.email as string | null,
            phone: lead.phone as string | null,
            city: lead.city as string | null,
            district: lead.district as string | null,
            state: lead.state as string | null,
            requirement: lead.requirement as string | null,
            status: lead.status,
            priority: lead.priority,
            category: (lead.category as string | null) ?? null,
            sourceId: lead.sourceId as string | null | undefined,
            source: lead.source as { id: string; name: string } | null | undefined,
            assignedUserId: lead.assignedUserId as string | null,
          }}
          leadSources={leadSources}
          submitLabel="Save"
        />
      )}

      <ConfirmDialog
        open={deleteFollowUpTarget !== null}
        title="Delete follow-up?"
        description="This will permanently delete this follow-up. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={deletingFollowUp}
        error={deleteFollowUpError}
        onConfirm={confirmDeleteFollowUp}
        onCancel={() => { setDeleteFollowUpTarget(null); setDeleteFollowUpError(null); }}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        title={leadDraft?.isArchived ? "Restore lead?" : "Archive lead?"}
        description={leadDraft?.isArchived ? "This will restore the lead from Archived." : "This will move the lead to Archived. You can restore it later."}
        confirmLabel={leadDraft?.isArchived ? "Restore" : "Archive"}
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={archivingConfirm}
        error={archiveConfirmError}
        onConfirm={confirmArchive}
        onCancel={() => { setArchiveConfirmOpen(false); setArchiveConfirmError(null); }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete lead?"
        description="This will permanently delete this lead. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={deletingConfirm}
        error={deleteConfirmError}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setDeleteConfirmError(null); }}
      />
    </div>
  );
}
