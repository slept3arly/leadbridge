export function createLeadTableDateBoundary(value: string, field: "dateFrom" | "dateTo"): Date {
  return new Date(`${value}T${field === "dateTo" ? "23:59:59.999" : "00:00:00"}`);
}
