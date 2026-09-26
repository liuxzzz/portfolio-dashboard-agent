export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatMoney(value: number, currency = "CNY"): string {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  }
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(duration) || duration < 0) return "—";
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} s`;
}
