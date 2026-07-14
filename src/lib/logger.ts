import pino from "pino";

export const logger = pino({
  name: "leadbridge",
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
});
