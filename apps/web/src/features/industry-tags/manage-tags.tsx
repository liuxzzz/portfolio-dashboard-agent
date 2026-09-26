import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { createIndustryTag, deleteIndustryTag } from "@/shared/api/portfolio";
import { usePortfolio } from "@/entities/portfolio/model";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { tagColors } from "./tag-colors";
export function ManageTags({ token }: { token: string }) {
  const { tags, refreshTags, refresh, setError } = usePortfolio();
  const [name, setName] = useState("");
  const [color, setColor] = useState(tagColors[0]!);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || tags.length >= 30) return;
    setBusy(true); setError(null);
    try { await createIndustryTag(token, name.trim(), color); setName(""); await refreshTags(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "新增标签失败"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true); setError(null);
    try { await deleteIndustryTag(token, pendingDelete.id); setPendingDelete(null); await refreshTags(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "删除标签失败"); }
    finally { setBusy(false); }
  }
  return <><Card><CardHeader><CardTitle>行业标签管理</CardTitle><CardDescription>创建自己的分类，再到持仓详情中指定。最多 30 个标签。</CardDescription></CardHeader><CardContent className="space-y-5"><form onSubmit={(event) => void create(event)} className="space-y-4"><div><label htmlFor="tag-name" className="mb-2 block text-sm font-medium">标签名称</label><Input id="tag-name" value={name} maxLength={20} onChange={(event) => setName(event.target.value)} placeholder="例如：高股息" /></div><fieldset><legend className="mb-2 text-sm font-medium">标签颜色</legend><div className="flex flex-wrap gap-2">{tagColors.map((item) => <button key={item} type="button" aria-label={`选择颜色 ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} className="h-9 w-9 rounded-full border-4 border-white ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-primary" style={{ backgroundColor: item }} />)}</div></fieldset><Button type="submit" disabled={!name.trim() || busy || tags.length >= 30}>{busy ? "保存中…" : "新增标签"}</Button></form><div className="space-y-2">{tags.length === 0 && <p className="text-sm text-muted-foreground">还没有自定义标签。</p>}{[...tags].sort((a,b) => a.sortOrder - b.sortOrder).map((tag) => <div key={tag.id} className="flex items-center justify-between rounded-lg bg-secondary p-3"><span className="flex items-center gap-3 text-sm font-medium"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => setPendingDelete({ id: tag.id, name: tag.name })}><Trash2 className="h-4 w-4" />删除</Button></div>)}</div></CardContent></Card><Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open && !busy) setPendingDelete(null); }}><DialogContent><DialogTitle>删除行业标签？</DialogTitle><DialogDescription className="mt-2 text-sm text-muted-foreground">删除“{pendingDelete?.name}”后，使用它的股票会恢复数据源自动分类。</DialogDescription><DialogFooter className="mt-6"><Button variant="outline" disabled={busy} onClick={() => setPendingDelete(null)}>取消</Button><Button variant="destructive" disabled={busy} onClick={() => void remove()}>删除</Button></DialogFooter></DialogContent></Dialog></>;
}
