import { Prisma } from "@/generated/prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { invalidateSettings, TAG } from "@/lib/cache-tags";
import { ServiceError } from "@/lib/service-errors";

interface SettingDefinition<T = unknown> {
  key: string;
  category: string;
  description: string;
  defaultValue: T;
}

const SETTINGS: Record<string, SettingDefinition> = {
  default_page_size: {
    key: "default_page_size",
    category: "System",
    description: "Default number of items per page in tables",
    defaultValue: 25,
  },
  audit_log_retention_limit: {
    key: "audit_log_retention_limit",
    category: "System",
    description: "Maximum number of audit log entries to retain. Oldest entries are automatically pruned when this limit is exceeded.",
    defaultValue: 1000,
  },
};

const getCachedSetting = unstable_cache(
  async (key: string) => prisma.setting.findUnique({ where: { key } }),
  ["setting-value"],
  { revalidate: 300, tags: [TAG.SETTINGS] },
);

async function getSettingValue(key: string) {
  try {
    return await getCachedSetting(key);
  } catch (error) {
    // Service-level smoke tests and CLI jobs do not have Next's request cache context.
    if (error instanceof Error && error.message.includes("incrementalCache missing")) {
      return prisma.setting.findUnique({ where: { key } });
    }
    throw error;
  }
}

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
    const db = await getSettingValue(key);
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
    if (client === prisma) invalidateSettings();
    return setting.value;
  }

  async updateMany(updates: Record<string, unknown>, updatedById?: string): Promise<Record<string, unknown>> {
    const keys = Object.keys(updates);
    const unknownKeys = keys.filter((key) => !SETTINGS[key]);
    if (unknownKeys.length) {
      throw new ServiceError(`Unknown setting key(s): ${unknownKeys.join(", ")}`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const results: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        results[key] = await this.update(key, value, updatedById, tx);
      }
      return results;
    });
    invalidateSettings();
    return result;
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
