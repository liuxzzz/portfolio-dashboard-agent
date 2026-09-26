import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatMoney, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
export function money(value: number | null | undefined, visible: boolean, currency = "CNY") {
  return !visible ? "••••••" : value == null ? "—" : formatMoney(value, currency);
}
export function percent(value: number | null | undefined, signed = false) {
  if (value == null) return "—";
  return `${signed && value > 0 ? "+" : ""}${formatPercent(value)}`;
}
export function Metric({ label, value, detail, className }: { label: string; value: string; detail?: string; className?: string }) {
  return <Card className={cn("min-w-0", className)}><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="break-words text-2xl font-semibold tracking-tight">{value}</div>{detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.2em] text-primary/70">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}
