"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";

type ProviderData = {
  id: string;
  name: string;
  slug: string;
  sourceType: string;
  active: boolean;
  description: string | null;
};

export function ProviderEditModal({
  open,
  onClose,
  provider,
}: {
  open: boolean;
  onClose: () => void;
  provider?: ProviderData | null;
}) {
  const router = useRouter();
  const isEdit = !!provider;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (provider) {
      setName(provider.name);
      setSlug(provider.slug);
      setSourceType(provider.sourceType);
      setDescription(provider.description ?? "");
      setActive(provider.active);
    } else {
      setName("");
      setSlug("");
      setSourceType("MANUAL");
      setDescription("");
      setActive(true);
    }
    setError(null);
  }, [open, provider]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (isEdit) {
        await axios.patch(`/api/providers/${provider!.id}`, { name, description: description || null });
      } else {
        await axios.post("/api/providers", { name, slug, sourceType, description: description || null });
      }
      onClose();
      router.refresh();
    } catch {
      setError(isEdit ? "Failed to update provider." : "Unable to create the provider right now.");
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 mt-16 mb-6 w-[90%] max-w-lg flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit Provider" : "Create Provider"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Provider Name" htmlFor="provider-name" required>
              <Input id="provider-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="e.g. Google Ads" />
            </FormField>

            {!isEdit && (
              <FormField label="Slug" htmlFor="provider-slug" required helperText="Lowercase letters, numbers, and hyphens only.">
                <Input id="provider-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required minLength={2} maxLength={120} pattern="^[a-z0-9-]+$" placeholder="e.g. google-ads" />
              </FormField>
            )}

            {!isEdit && (
              <FormField label="Source Type" htmlFor="provider-type" required>
                <Input id="provider-type" value={sourceType} onChange={(e) => setSourceType(e.target.value)} required minLength={2} maxLength={60} placeholder="e.g. MARKETING" />
              </FormField>
            )}

            <FormField label="Description" htmlFor="provider-description">
              <Input id="provider-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Optional description" />
            </FormField>

            {isEdit && (
              <FormField label="Status" htmlFor="provider-active">
                <Select id="provider-active" value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FormField>
            )}

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Provider"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
