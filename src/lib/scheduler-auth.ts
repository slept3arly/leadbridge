import { createHash, timingSafeEqual } from "node:crypto";

export function isSchedulerSecretAuthorized(
  request: Request,
  secret = process.env.SCHEDULER_TRIGGER_SECRET ?? "",
): boolean {
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return false;

  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, supplied);
}
