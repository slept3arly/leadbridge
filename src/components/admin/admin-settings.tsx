"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { SkeletonCard } from "@/components/ui/loading";
import { getErrorMessage } from "@/lib/get-error-message";
import { Save, RotateCcw } from "lucide-react";

type SettingDef = {
  key: string;
  category: string;
  description: string;
  defaultValue: unknown;
};

type SettingsData = {
  settings: Record<string, unknown>;
  definitions: SettingDef[];
};

type ValidationErrors = Record<string, string>;

const VALIDATORS: Record<string, (value: string) => string | null> = {
  default_page_size: (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 5 || n > 200) return "Must be an integer between 5 and 200";
    return null;
  },
};

export function AdminSettings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationErrors>({});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings");
      const json = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(json.error, "Failed to load settings"));
      const settings = json.data.settings as Record<string, unknown>;
      const definitions = json.data.definitions as SettingDef[];
      const initial: Record<string, string> = {};
      for (const def of definitions) {
        initial[def.key] = String(settings[def.key] ?? def.defaultValue);
      }
      setData({ settings, definitions });
      setValues(initial);
      setInitialValues(initial);
      setValidation({});
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSettings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  const hasChanges = Object.keys(values).some((key) => values[key] !== initialValues[key]);

  const validate = useCallback((newValues: Record<string, string>): ValidationErrors => {
    const errs: ValidationErrors = {};
    for (const [key, value] of Object.entries(newValues)) {
      const validator = VALIDATORS[key];
      if (validator) {
        const result = validator(value);
        if (result) errs[key] = result;
      }
    }
    return errs;
  }, []);

  const setValue = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    const errs = validate(next);
    setValidation(errs);
  };

  const resetDefaults = () => {
    if (!data) return;
    const defaults: Record<string, string> = {};
    for (const def of data.definitions) {
      defaults[def.key] = String(def.defaultValue);
    }
    setValues(defaults);
    setValidation(validate(defaults));
  };

  const discardChanges = () => {
    setValues({ ...initialValues });
    setValidation({});
    setError(null);
    setSuccess(null);
  };

  const isFormValid = Object.keys(validation).length === 0;

  const handleSave = async () => {
    if (!isFormValid) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const changed: Record<string, unknown> = {};
      for (const key of Object.keys(values)) {
        if (values[key] !== initialValues[key]) {
          const def = data?.definitions.find((d) => d.key === key);
          if (typeof def?.defaultValue === "number") {
            changed[key] = Number(values[key]);
          } else {
            changed[key] = values[key];
          }
        }
      }

      if (Object.keys(changed).length === 0) {
        setSuccess("No changes to save.");
        setTimeout(() => setSuccess(null), 2000);
        setSaving(false);
        return;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body.error, "Failed to save settings"));
      }

      setSuccess("Settings saved successfully.");
      setInitialValues({ ...values });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="flex justify-end gap-2"><div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" /><div className="h-9 w-32 animate-pulse rounded-lg bg-slate-200" /></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-red-600" role="alert">{error}</p>
          <Button variant="secondary" onClick={() => void loadSettings()} className="mt-4">Try again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const categories = [...new Set(data.definitions.map((d) => d.category))];

  return (
    <div className="space-y-6">
      {(error || success) && (
        <Card>
          <CardContent>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            {success && <p className="text-sm text-emerald-600" role="status">{success}</p>}
          </CardContent>
        </Card>
      )}

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {data.definitions
                .filter((d) => d.category === category)
                .map((def) => (
                  <FormField
                    key={def.key}
                    label={def.key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    htmlFor={`setting-${def.key}`}
                    helperText={def.description}
                    error={validation[def.key] ?? null}
                  >
                    <Input
                      id={`setting-${def.key}`}
                      type={typeof def.defaultValue === "number" ? "number" : "text"}
                      min={def.key === "default_page_size" ? 5 : undefined}
                      max={def.key === "default_page_size" ? 200 : undefined}
                      step={def.key === "default_page_size" ? 1 : undefined}
                      value={values[def.key] ?? ""}
                      onChange={(e) => setValue(def.key, e.target.value)}
                      disabled={saving}
                    />
                  </FormField>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={resetDefaults}
            disabled={saving}
          >
            <RotateCcw size={14} />
            Restore Defaults
          </Button>
          {hasChanges && <Button variant="ghost" size="sm" onClick={discardChanges} disabled={saving}>Discard Changes</Button>}
        </div>
        <Button
          onClick={handleSave}
          isLoading={saving}
          disabled={!hasChanges || !isFormValid}
        >
          <Save size={16} />
          {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
        </Button>
      </div>
    </div>
  );
}
