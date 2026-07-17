import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-errors";

interface SettingDefinition<T = unknown> {
  key: string;
  category: string;
  description: string;
  defaultValue: T;
}

const SETTINGS: Record<string, SettingDefinition> = {
  company_name: { key: "company_name", category: "company", description: "Company name", defaultValue: "LeadBridge" },
  crm_default_status: { key: "crm_default_status", category: "crm", description: "Default lead status on creation", defaultValue: "NEW" },
  crm_default_assignee: { key: "crm_default_assignee", category: "crm", description: "Default assignee user ID", defaultValue: null },
  crm_auto_assign: { key: "crm_auto_assign", category: "crm", description: "Auto-assign leads to sales users", defaultValue: false },
  connector_retry_count: { key: "connector_retry_count", category: "connector", description: "Default retry count for connectors", defaultValue: 3 },
  connector_timeout_ms: { key: "connector_timeout_ms", category: "connector", description: "Default timeout in milliseconds", defaultValue: 30000 },
  connector_duplicate_policy: { key: "connector_duplicate_policy", category: "connector", description: "Duplicate handling policy", defaultValue: "skip" },
  system_timezone: { key: "system_timezone", category: "system", description: "System timezone", defaultValue: "UTC" },
  system_date_format: { key: "system_date_format", category: "system", description: "Date format", defaultValue: "YYYY-MM-DD" },
  system_pagination_size: { key: "system_pagination_size", category: "system", description: "Default pagination size", defaultValue: 50 },
  notification_email_enabled: { key: "notification_email_enabled", category: "notification", description: "Enable email notifications", defaultValue: true },
  notification_system_enabled: { key: "notification_system_enabled", category: "notification", description: "Enable system notifications", defaultValue: true },
  audit_retention_days: { key: "audit_retention_days", category: "audit", description: "Audit log retention in days", defaultValue: 90 },
};

export class SettingsService {
  getDefinitions() {
    return Object.entries(SETTINGS).map(([key, def]) => ({
      key,
      category: def.category,
      description: def.description,
      defaultValue: def.defaultValue,
    }));
  }

  async getAll(): Promise<Record<string, unknown>> {
    const dbSettings = await prisma.setting.findMany();
    const dbMap = new Map(dbSettings.map((s) => [s.key, s.value]));

    const result: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(SETTINGS)) {
      const dbValue = dbMap.get(key);
      result[key] = dbValue !== undefined ? dbValue : def.defaultValue;
    }
    return result;
  }

  async get<T>(key: string): Promise<T | null> {
    const def = SETTINGS[key];
    if (!def) return null;
    const db = await prisma.setting.findUnique({ where: { key } });
    return (db?.value as T | undefined) ?? (def.defaultValue as T);
  }

  async update(key: string, value: unknown, updatedById?: string, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<unknown> {
    const definition = SETTINGS[key];
    if (!definition) throw new ServiceError(`Unknown setting: ${key}`, 400);
    const setting = await client.setting.upsert({
      where: { key },
      create: { key, value: value as object, category: definition.category, description: definition.description, updatedById },
      update: { value: value as object, updatedById },
    });
    return setting.value;
  }

  async updateMany(updates: Record<string, unknown>, updatedById?: string): Promise<Record<string, unknown>> {
    const keys = Object.keys(updates);
    const unknownKeys = keys.filter((key) => !SETTINGS[key]);
    if (unknownKeys.length) {
      throw new ServiceError(`Unknown setting key(s): ${unknownKeys.join(", ")}`, 400);
    }

    return prisma.$transaction(async (tx) => {
      const results: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        results[key] = await this.update(key, value, updatedById, tx);
      }
      return results;
    });
  }

  async getByCategory(category: string): Promise<Record<string, unknown>> {
    const all = await this.getAll();
    const result: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(SETTINGS)) {
      if (def.category === category) {
        result[key] = all[key];
      }
    }
    return result;
  }
}

export const settingsService = new SettingsService();
