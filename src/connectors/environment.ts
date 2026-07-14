import type { ConfiguredGmailAccount } from "./types";

const requiredGmailFields = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"] as const;

export function discoverGmailAccounts(env: NodeJS.ProcessEnv = process.env): ConfiguredGmailAccount[] {
  const keys = Object.keys(env)
    .map((key) => key.match(/^GMAIL_([A-Z0-9_]+)_CLIENT_ID$/)?.[1])
    .filter((key): key is string => Boolean(key));

  return [...new Set(keys)].sort().map((key) => {
    const missing = requiredGmailFields.filter((field) => !env[`GMAIL_${key}_${field}`]);
    return {
      key,
      name: key.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" "),
      status: missing.length ? "INCOMPLETE" : "READY",
      missing,
    };
  });
}

export function getGmailCredentials(key: string, env: NodeJS.ProcessEnv = process.env) {
  const normalized = key.toUpperCase();
  return {
    clientId: env[`GMAIL_${normalized}_CLIENT_ID`],
    clientSecret: env[`GMAIL_${normalized}_CLIENT_SECRET`],
    refreshToken: env[`GMAIL_${normalized}_REFRESH_TOKEN`],
  };
}
