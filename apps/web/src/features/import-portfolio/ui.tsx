import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { importPortfolioXlsx } from "@/shared/api/portfolio";
import { usePortfolio } from "@/entities/portfolio/model";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
export function ImportPortfolio({ token }: { token: string }) {
  const { refresh, setError } = usePortfolio();
  const [file, setFile] = useState<File | null>(null);
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 10 * 1024 * 1024) { setError("请选择不超过 10 MiB 的 .xlsx 文件。"); return; }
    setBusy(true); setError(null); setNotice(null);
    try { const result = await importPortfolioXlsx(token, file, accountName); setNotice(result.duplicate ? "已复用相同快照与分析结果。" : `已导入 ${result.positionCount} 条持仓并生成分析。`); setFile(null); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "导入失败"); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>导入持仓</CardTitle><CardDescription>上传同花顺“持仓数据”导出的 XLSX，后端会保存快照并生成首次分析。</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}><label htmlFor="xlsx-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-secondary/40 p-6 text-center text-sm text-primary"><Upload className="h-6 w-6" /><strong>{file?.name ?? "选择 XLSX 文件"}</strong><small className="text-muted-foreground">仅支持 .xlsx，最大 10 MiB</small></label><input id="xlsx-file" type="file" className="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div><label htmlFor="account-name" className="mb-2 block text-sm font-medium">组合名称（可选）</label><Input id="account-name" value={accountName} maxLength={100} onChange={(event) => setAccountName(event.target.value)} placeholder="例如：我的持仓" /></div><Button type="submit" disabled={!file || busy}>{busy ? "导入中…" : "导入并分析"}</Button>{notice && <p role="status" className="text-sm text-primary">{notice}</p>}</form></CardContent></Card>;
}
