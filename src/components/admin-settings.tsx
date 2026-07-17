"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";

interface SettingDef {
  key: string;
  category: string;
  description: string;
  defaultValue: unknown;
}

interface SettingsData {
  settings: Record<string, unknown>;
  definitions: SettingDef[];
}

export function AdminSettings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setData(json.data);
        const initial: Record<string, string> = {};
        for (const [key, value] of Object.entries(json.data.settings)) {
          initial[key] = String(value ?? "");
        }
        setEdited(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(edited)) {
        const def = data?.definitions.find((d) => d.key === key);
        if (def?.defaultValue === true || def?.defaultValue === false) {
          payload[key] = value === "true";
        } else if (typeof def?.defaultValue === "number") {
          payload[key] = Number(value);
        } else {
          payload[key] = value;
        }
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccess("Settings saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (error && !data) return <Card><CardContent><p className="text-red-600">{error}</p></CardContent></Card>;
  if (!data) return null;

  const categories = [...new Set(data.definitions.map((d) => d.category))];

  return (
    <div className="space-y-8">
      {error && <Card><CardContent><p className="text-red-600">{error}</p></CardContent></Card>}
      {success && <Card><CardContent><p className="text-green-600">{success}</p></CardContent></Card>}

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.definitions
                .filter((d) => d.category === category)
                .map((def) => (
                  <div key={def.key}>
                    <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">{def.key.replace(/_/g, " ")}</label>
                    <p className="text-xs text-[var(--color-muted)] mb-2">{def.description}</p>
                    {def.defaultValue === true || def.defaultValue === false ? (
                      <Select value={edited[def.key] ?? ""} onChange={(e) => setEdited((prev) => ({ ...prev, [def.key]: e.target.value }))}>
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </Select>
                    ) : (
                      <Input value={edited[def.key] ?? ""} onChange={(e) => setEdited((prev) => ({ ...prev, [def.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>Save Settings</Button>
      </div>
    </div>
  );
}
