"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExpandableSection } from "@/components/ui/expandable-section";
import { toast } from "@/lib/toast";
import { useLeadDetails } from "@/hooks/use-lead-details";

export function NotesPanel({ leadId, currentUserId, isAdmin }: { leadId: string; currentUserId: string; isAdmin: boolean }) {
  const { data, loading, refresh } = useLeadDetails(leadId);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editHistory, setEditHistory] = useState<Record<string, string>>({});

  useEffect(() => {
    const history: Record<string, string> = {};
    for (const act of data?.activities ?? []) {
      if (act.type === "NOTE_EDITED" && act.metadata?.noteId && act.metadata?.oldContent) {
        history[String(act.metadata.noteId)] = String(act.metadata.oldContent);
      }
    }
    setEditHistory(history);
  }, [data?.activities]);

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await axios.post(`/api/leads/${leadId}/notes`, { content });
      setContent("");
      toast.success("Note added");
      await refresh();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  async function updateNote(id: string) {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await axios.patch(`/api/notes/${id}`, { content: editContent });
      setEditingId(null);
      setEditContent("");
      toast.success("Note updated");
      await refresh();
    } catch {
      toast.error("Failed to update note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await axios.delete(`/api/notes/${id}`);
      toast.success("Note deleted");
      await refresh();
    } catch {
      toast.error("Failed to delete note");
    }
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 rounded-xl bg-slate-100" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-50" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1"
        />
        <Button size="sm" isLoading={saving} onClick={addNote} disabled={!content.trim()}>
          Add
        </Button>
      </div>

      {(data?.notes ?? []).length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No notes yet.</p>
      ) : (
        <ExpandableSection initialVisible={5} itemCount={(data?.notes ?? []).length}>
          {(data?.notes ?? []).map((note) => {
            const wasEdited = note.editedAt !== note.createdAt;
            return (
              <div key={note.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-ink)]">{note.author.name}</span>
                    <span className="text-xs text-[var(--color-muted)]">{formatDateTime(note.createdAt)}</span>
                    {wasEdited && (
                      <span className="text-xs text-[var(--color-muted)] italic">(edited)</span>
                    )}
                  </div>
                  {(note.authorId === currentUserId || isAdmin) && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" isLoading={saving} onClick={() => updateNote(note.id)}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    {wasEdited && editHistory[note.id] && (
                      <details className="text-xs text-[var(--color-muted)]">
                        <summary className="cursor-pointer hover:text-[var(--color-ink)] mt-1">
                          Show previous version
                        </summary>
                        <div className="mt-1 rounded-lg bg-slate-50 p-2 whitespace-pre-wrap border border-[var(--color-border)]">
                          {editHistory[note.id]}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </ExpandableSection>
      )}
    </div>
  );
}
