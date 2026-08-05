export function formatCurrency(value: number | null | undefined, showSign = false) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}¥${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function formatPercent(
  value: number | null | undefined,
  showSign = false,
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function formatTime(value: string | null | undefined) {
  if (!value) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
