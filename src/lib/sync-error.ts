const SECRET_ASSIGNMENT = /\b(password|passwd|token|secret|credential|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/giu;
const AUTHORIZATION = /\b(authorization\s*:\s*)(?:bearer|basic)\s+[^\s,;]+/giu;
const AUTH_TOKEN = /\b(?:bearer|basic)\s+[a-z\d._~+/=-]+/giu;
const SENSITIVE_HEADER = /\b(cookie|set-cookie|x-auth-token|x-api-key|x-access-token)\s*:\s*[^\r\n]+/giu;
const CONNECTION_STRING = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s"'<>]+/giu;
const URL_CREDENTIALS = /([a-z][a-z\d+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/giu;

/** Keeps useful sync diagnostics while removing common credential and connection-string forms. */
export function sanitizeSyncErrorDiagnostic(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(CONNECTION_STRING, "[REDACTED CONNECTION STRING]")
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(AUTHORIZATION, "$1[REDACTED]")
    .replace(AUTH_TOKEN, "[REDACTED]")
    .replace(SENSITIVE_HEADER, "$1: [REDACTED]")
    .replace(SECRET_ASSIGNMENT, "$1$2[REDACTED]");
}
