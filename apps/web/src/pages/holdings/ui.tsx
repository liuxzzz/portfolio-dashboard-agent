import { usePortfolio } from "@/entities/portfolio/model";
import { PageHeading, money, percent } from "@/entities/portfolio/ui";
import { Card, CardContent } from "@/shared/ui/card";
import { ChevronRight } from "lucide-react";
export function HoldingsPage({ visible, onOpenPosition }: { visible: boolean; onOpenPosition: (symbol: string) => void }) {
  const { dashboard } = usePortfolio();
  const positions = [...(dashboard?.snapshot.positions ?? [])].sort((a,b) => b.marketValue - a.marketValue);
  return <><PageHeading eyebrow="POSITIONS" title="全部持仓" description="按最新市值排序 · 点击查看详情与行业标签" /><div className="space-y-3">{positions.length ? positions.map((item) => <button key={`${item.market}:${item.symbol}`} onClick={() => onOpenPosition(item.symbol)} className="w-full text-left"><Card className="transition-colors hover:border-primary/40"><CardContent className="flex items-center gap-4 p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-primary">{item.symbol.slice(-4)}</div><div className="min-w-0 flex-1"><strong className="block truncate">{item.name}</strong><span className="text-xs text-muted-foreground">{item.industry ?? "未分类"} · {percent(item.portfolioWeight)}</span></div><div className="text-right"><strong className="block text-sm">{money(item.marketValue, visible)}</strong><span className={item.dayProfit != null && item.dayProfit < 0 ? "text-xs text-emerald-600" : "text-xs text-rose-600"}>{percent(item.dayProfitRate, true)}</span></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></button>) : <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">暂无持仓数据</CardContent></Card>}</div></>;
}
