export type CsvCellKind = "text" | "number" | "phone";

export function escapeCsv(value: unknown, kind: CsvCellKind = "text"): string {
  let str = value == null ? "" : String(value);
  const safeNumeric = kind === "number" && /^-?(?:\d+\.?\d*|\.\d+)$/u.test(str);
  if (typeof value !== "number" && typeof value !== "bigint" && !safeNumeric) {
    const formulaCandidate = str.replace(/^[\s\u0000-\u001f\u007f]+/u, "");
    const safePhone = /^\+\d[\d\s().-]*$/u.test(str);
    if (/^[=\t\r]/u.test(str) || /^[=@]/u.test(formulaCandidate) || (/^[+\-]/u.test(formulaCandidate) && !(kind === "phone" && safePhone))) str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(values: unknown[], kinds: readonly CsvCellKind[] = []): string {
  return values.map((value, index) => escapeCsv(value, kinds[index] ?? "text")).join(",") + "\n";
}
