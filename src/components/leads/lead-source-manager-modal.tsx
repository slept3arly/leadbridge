"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { X, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

export type SourceItem = {
  id: string;
  name: string;
};

export function LeadSourceManagerModal({
  open,
  onClose,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  sources: SourceItem[];
}) {
  const router = useRouter();
  const [sourceList, setSourceList] = useState<SourceItem[]>(sources);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSourceList(sources);
  }, [sources]);

  useEffect(() => {
    if (!open) return;
    setNewName("");
    setError(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Please enter a lead source name.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await axios.post<SourceItem>("/api/lead-sources", { name: trimmed });
      const created = res.data;

      // Update local list if not present
      setSourceList((prev) => {
        if (prev.some((s) => s.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });

      setNewName("");
      toast.success(`Lead source "${created.name}" added`);
      router.refresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to add lead source.");
      }
    } finally {
      setPending(false);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the lead source "${name}"?`)) return;

    setDeletingId(id);
    setError(null);

    try {
      await axios.delete(`/api/lead-sources/${id}`);
      setSourceList((prev) => prev.filter((s) => s.id !== id));
      toast.success(`Lead source "${name}" removed`);
      router.refresh();
    } catch {
      toast.error("Failed to remove lead source.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Lead Sources</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Lead Sources List */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {sourceList.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] italic py-2 text-center">
              No lead sources created yet.
            </p>
          ) : (
            sourceList.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-2.5 text-sm"
              >
                <span className="font-medium text-[var(--color-ink)]">{src.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteSource(src.id, src.name)}
                  disabled={deletingId === src.id}
                  className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600 transition"
                  title="Remove lead source"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <hr className="border-[var(--color-border)]" />

        {/* Add Lead Source Form */}
        <form onSubmit={handleAddSource} className="space-y-4">
          <FormField label="Add Lead Source" htmlFor="new-source-name">
            <Input
              id="new-source-name"
              placeholder="e.g. Google Ads, Referral, WhatsApp"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={pending}
            />
          </FormField>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Done
            </Button>
            <Button type="submit" isLoading={pending}>
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
