import { useState } from "react";
import { Bot, Copy, RefreshCw } from "lucide-react";
import { runAgent } from "@/shared/api/portfolio";
import { usePortfolio } from "@/entities/portfolio/model";
import { Insights } from "@/entities/agent/insights";
import { PageHeading } from "@/entities/portfolio/ui";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { formatDate, formatDuration } from "@/shared/lib/format";
export function AgentPage({ token }: { token: string }) {
  const { dashboard, refresh, setError } = usePortfolio();
  const [running, setRunning] = useState(false);
  const [raw, setRaw] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Awaited<ReturnType<typeof runAgent>> | null>(null);
  const run = runResult?.snapshotId === dashboard?.snapshot.id ? runResult : dashboard?.latestAgentRun ?? null;
  async function trigger() {
    setRunning(true); setError(null); setNotice(null);
    try { const result = await runAgent(token); setRunResult(result); await refresh(); setNotice("组合观察已更新。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Agent 运行失败"); }
    finally { setRunning(false); }
  }
  async function copy() {
    if (!run) return;
    try { await navigator.clipboard.writeText(JSON.stringify(run, null, 2)); setNotice("运行响应已复制。"); }
    catch { setError("复制失败，请从原始响应中手动复制。"); }
  }
  return <><PageHeading eyebrow="EVIDENCE-FIRST AGENT" title="组合观察" description="事实规则先行，模型解释后置，每条结论都能回到证据。" action={<Button disabled={!dashboard || running} onClick={() => void trigger()}><RefreshCw className="h-4 w-4" />{running ? "分析中…" : "重新分析"}</Button>} /><Card className="mb-4 bg-secondary"><CardContent className="flex items-start gap-4 p-5"><Bot className="h-6 w-6 shrink-0 text-primary" /><div><strong>当前运行：确定性规则引擎</strong><p className="mt-1 text-sm text-muted-foreground">检查数据新鲜度、集中度和现金缓冲；不生成买卖指令。</p></div></CardContent></Card>{notice && <p role="status" className="mb-4 text-sm text-primary">{notice}</p>}<div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"><section aria-label="分析结果"><Insights run={run} /></section><Card className="h-fit"><CardHeader><CardTitle>运行详情</CardTitle><CardDescription>服务端持久化的最新 Run</CardDescription></CardHeader><CardContent>{run ? <><dl className="space-y-3 text-sm">{[["Run ID", run.id], ["状态", run.status], ["开始时间", formatDate(run.requestedAt)], ["耗时", formatDuration(run.requestedAt, run.completedAt)], ["模型", run.model ?? "未调用模型"], ["快照 ID", run.snapshotId]].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b pb-2"><dt className="text-muted-foreground">{label}</dt><dd className="max-w-[60%] truncate text-right" title={value}>{value}</dd></div>)}</dl><div className="mt-5 flex gap-2"><Button variant="outline" size="sm" onClick={() => setRaw(!raw)}>{raw ? "收起" : "查看"}原始响应</Button><Button variant="ghost" size="sm" onClick={() => void copy()}><Copy className="h-4 w-4" />复制</Button></div>{raw && <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-[#17283a] p-4 text-xs text-slate-100">{JSON.stringify(run, null, 2)}</pre>}</> : <p className="text-sm text-muted-foreground">暂无运行记录。</p>}</CardContent></Card></div></>;
}
