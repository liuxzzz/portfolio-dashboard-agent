import { ArrowLeft } from "lucide-react";
import { usePortfolio } from "@/entities/portfolio/model";
import { Metric, PageHeading, money, percent } from "@/entities/portfolio/ui";
import { AssignTag } from "@/features/industry-tags/assign-tag";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/lib/format";
export function PositionPage({ token, symbol, visible, onBack }: { token: string; symbol: string; visible: boolean; onBack: () => void }) {
  const { dashboard } = usePortfolio();
  const snapshot = dashboard?.snapshot;
  const position = snapshot?.positions.find((item) => item.symbol === symbol);
  return <><Button variant="ghost" className="mb-4" onClick={onBack}><ArrowLeft className="h-4 w-4" />返回持仓</Button>{!position || !snapshot ? <p>没有找到这条持仓。</p> : <><PageHeading eyebrow={`${position.market} · ${position.symbol}`} title={position.name} description={position.industry ?? "未分类行业"} /><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-4"><AssignTag key={`${position.market}:${position.symbol}:${position.industryTagId ?? "auto"}`} token={token} position={position} /><Card className="border-0 bg-[#19314a] text-white"><CardContent className="p-7"><p className="text-sm text-slate-300">最新价</p><strong className="mt-3 block text-4xl">{money(position.currentPrice, visible)}</strong><p className="mt-5 text-xs text-slate-400">快照时间 {formatDate(snapshot.capturedAt)}</p></CardContent></Card></div><div className="grid gap-4 sm:grid-cols-2"><Metric label="持有金额" value={money(position.marketValue, visible)} detail={`组合占比 ${percent(position.portfolioWeight)}`} /><Metric label="持有盈亏" value={money(position.holdingProfit, visible)} detail={percent(position.holdingProfitRate, true)} /><Metric label="单位成本" value={money(position.unitCost, visible)} detail={`${position.holdingDays ?? "—"} 个持仓日`} /><Metric label="持有数量" value={position.quantity.toLocaleString("zh-CN")} />{position.relatedSector && <Metric label="相关行业" value={position.relatedSector} detail={`行业当日 ${percent(position.sectorRate, true)}`} />}</div></div><Card className="mt-4"><CardHeader><CardTitle>数据证据</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-muted-foreground">数量、成本和持仓天数来自账户持仓接口；最新价来自行情接口；市值、仓位和盈亏由标准化计算层生成。</CardContent></Card></>}</>;
}
