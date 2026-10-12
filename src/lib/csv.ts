export function escapeCsv(value: unknown): string {
  let str = value == null ? "" : String(value);
  if (typeof value !== "number" && typeof value !== "bigint") {
    const formulaCandidate = str.replace(/^[\s\u0000-\u001f\u007f]+/u, "");
    if (/^[=+\-@\t\r]/u.test(str) || /^[=+\-@]/u.test(formulaCandidate)) str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(",") + "\n";
}
