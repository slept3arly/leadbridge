"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { LoadingSpinner, SkeletonCard } from "@/components/ui/loading";
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
  audit_log_retention_limit: (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 100 || n > 100000) return "Must be an integer between 100 and 100,000";
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

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        const settings = json.data.settings as Record<string, unknown>;
        const defs = json.data.definitions as SettingDef[];
        setData({ settings, definitions: defs });
        const initial: Record<string, string> = {};
        for (const def of defs) {
          const val = settings[def.key] ?? def.defaultValue;
          initial[def.key] = String(val);
        }
        setValues({ ...initial });
        setInitialValues(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  const resetDefaults = async () => {
    if (!data) return;
    const defaults: Record<string, string> = {};
    for (const def of data.definitions) {
      defaults[def.key] = String(def.defaultValue);
    }
    setValues(defaults);
    setValidation(validate(defaults));
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
        throw new Error(body.error || "Failed to save settings");
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
        {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
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
                      value={values[def.key] ?? ""}
                      onChange={(e) => setValue(def.key, e.target.value)}
                    />
                  </FormField>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={resetDefaults}
            disabled={saving}
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </Button>
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
