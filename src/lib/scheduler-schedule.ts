export type ConnectorSchedule = "MANUAL" | "EVERY_5_MIN" | "EVERY_15_MIN" | "EVERY_30_MIN" | "HOURLY" | "DAILY" | "CUSTOM";

const INTERVAL_MS: Record<Exclude<ConnectorSchedule, "MANUAL" | "CUSTOM">, number> = {
  EVERY_5_MIN: 5 * 60 * 1000,
  EVERY_15_MIN: 15 * 60 * 1000,
  EVERY_30_MIN: 30 * 60 * 1000,
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
};

export function getScheduleIntervalMs(
  scheduleType: ConnectorSchedule,
  scheduleConfig: Record<string, unknown> | null,
): number | null {
  if (scheduleType === "MANUAL") return null;
  if (scheduleType !== "CUSTOM") return INTERVAL_MS[scheduleType];

  const minutes = scheduleConfig?.intervalMinutes;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > 525600) return null;
  return minutes * 60 * 1000;
}

export function computeNextScheduledRun(
  scheduleType: ConnectorSchedule,
  scheduleConfig: Record<string, unknown> | null,
  from = new Date(),
): Date | null {
  const intervalMs = getScheduleIntervalMs(scheduleType, scheduleConfig);
  return intervalMs === null ? null : new Date(from.getTime() + intervalMs);
}
