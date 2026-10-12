import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_REST_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_REST_TOTAL_RESPONSE_BYTES = 20 * 1024 * 1024;
export const MAX_REST_REQUEST_BODY_BYTES = 1 * 1024 * 1024;
export const MAX_REST_RECORDS = 25_000;
export const MAX_REST_PAGES = 100;
export const MAX_REST_PAGE_SIZE = 500;
export const MAX_REST_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_REST_EXECUTION_MS = 120_000;
export const MAX_REST_REDIRECTS = 5;

export class RestSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestSecurityError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface ValidatedRestUrl {
  url: URL;
  hostname: string;
  addresses: ResolvedAddress[];
}

type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

function parseIpv4(address: string): bigint {
  return address.split(".").reduce((value, part) => (value << BigInt(8)) | BigInt(Number(part)), BigInt(0));
}

function parseIpv6(address: string): bigint {
  let value = address.toLowerCase();
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = value.slice(lastColon + 1);
    const octets = ipv4.split(".").map(Number);
    value = `${value.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const [leftPart, rightPart = ""] = value.split("::");
  const left = leftPart ? leftPart.split(":") : [];
  const right = rightPart ? rightPart.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) throw new RestSecurityError("Invalid IPv6 address.");
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  return groups.reduce((result, group) => (result << BigInt(16)) | BigInt(parseInt(group || "0", 16)), BigInt(0));
}

function inCidr(address: string, cidr: string): boolean {
  const [network, prefixText] = cidr.split("/");
  const family = isIP(address);
  if (!family || family !== isIP(network)) return false;
  const prefix = Number(prefixText);
  const bits = family === 4 ? 32 : 128;
  const input = family === 4 ? parseIpv4(address) : parseIpv6(address);
  const base = family === 4 ? parseIpv4(network) : parseIpv6(network);
  const shift = BigInt(bits - prefix);
  return (input >> shift) === (base >> shift);
}

const NON_PUBLIC_IPV4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
  "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
  "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
  "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

const NON_PUBLIC_IPV6 = [
  "2001::/23", "2001:db8::/32", "2002::/16", "3fff::/20",
];

export function isPublicRoutableAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC_IPV4.some((range) => inCidr(address, range));
  if (family !== 6 || !inCidr(address, "2000::/3")) return false;
  return !NON_PUBLIC_IPV6.some((range) => inCidr(address, range));
}

export function validateRestRedirectTarget(location: string, currentUrl: URL, allowedOrigins = parseAllowedOrigins()): URL {
  let target: URL;
  try { target = new URL(location, currentUrl); } catch { throw new RestSecurityError("REST redirect destination is invalid."); }
  // Scheme, origin allowlisting, and DNS/IP policy are checked by validateRestUrl before connecting.
  if (target.origin !== currentUrl.origin && !allowedOrigins.has(target.origin)) {
    throw new RestSecurityError("Cross-origin pagination or redirects require an explicitly allowlisted origin.");
  }
  if (!["https:", "http:"].includes(target.protocol)) throw new RestSecurityError("REST redirect uses a prohibited scheme.");
  return target;
}

export function parseAllowedOrigins(value = process.env.REST_CONNECTOR_ALLOWED_ORIGINS ?? ""): Set<string> {
  const origins = new Set<string>();
  for (const raw of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    try {
      const url = new URL(raw);
      if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        continue;
      }
      origins.add(url.origin);
    } catch {
      // Invalid allowlist entries are ignored; they never broaden access.
    }
  }
  return origins;
}

async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new RestSecurityError("REST destination DNS resolution timed out.")), 5_000); });
  let result: Array<{ address: string; family: number }>;
  try { result = await Promise.race([lookup(hostname, { all: true, verbatim: true }), timeout]); }
  finally { if (timer) clearTimeout(timer); }
  return result.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }));
}

export async function validateRestUrl(
  input: string | URL,
  options: {
    allowedOrigins?: Set<string>;
    previousOrigin?: string;
    resolve?: Resolver;
  } = {},
): Promise<ValidatedRestUrl> {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    throw new RestSecurityError("REST request URL is invalid.");
  }

  if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.hash || url.hostname.includes("%")) {
    throw new RestSecurityError("REST request URL uses a prohibited scheme or authority.");
  }

  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins();
  const isExplicitlyAllowed = allowedOrigins.has(url.origin);
  if (url.protocol !== "https:" && !isExplicitlyAllowed) {
    throw new RestSecurityError("REST requests require HTTPS unless the exact HTTP origin is allowlisted.");
  }
  if (options.previousOrigin && url.origin !== options.previousOrigin && !isExplicitlyAllowed) {
    throw new RestSecurityError("Cross-origin pagination or redirects require an explicitly allowlisted origin.");
  }

  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family: family as 4 | 6 }]
    : await (options.resolve ?? resolveHost)(hostname);

  if (addresses.length === 0 || addresses.some((entry) => !isIP(entry.address))) {
    throw new RestSecurityError("REST destination did not resolve to a valid IP address.");
  }
  if (!isExplicitlyAllowed && addresses.some((entry) => !isPublicRoutableAddress(entry.address))) {
    throw new RestSecurityError("REST destination resolves to a prohibited network address.");
  }

  return { url, hostname, addresses };
}

