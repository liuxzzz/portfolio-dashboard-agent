import type { AgentInsight, AgentRun } from "@portfolio/domain";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/lib/format";
export function Insights({ run }: { run: AgentRun | null }) {
  if (!run) return <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">暂无 Agent 运行记录。点击“重新分析”开始。</CardContent></Card>;
  return <div className="space-y-3">{run.insights.map((item) => <Insight key={item.id} item={item} />)}<p className="pt-3 text-xs leading-6 text-muted-foreground">{run.disclaimer}</p></div>;
}
function Insight({ item }: { item: AgentInsight }) {
  const label = item.severity === "risk" ? "风险" : item.severity === "attention" ? "关注" : "信息";
  return <Card className={item.severity === "risk" ? "border-l-4 border-l-rose-400" : item.severity === "attention" ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-sky-400"}><CardContent className="p-5"><div className="mb-3 flex items-center justify-between"><Badge variant="secondary">{label}</Badge><span className="text-[11px] text-muted-foreground">置信度 {(item.confidence * 100).toFixed(0)}%</span></div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p><div className="mt-4 space-y-2 border-t pt-3">{item.evidence.map((evidence, index) => <div key={`${evidence.referenceId}:${index}`} className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1">{evidence.label} · {evidence.kind} · {evidence.referenceId}</span><time className="shrink-0">{formatDate(evidence.asOf)}</time></div>)}</div></CardContent></Card>;
}
