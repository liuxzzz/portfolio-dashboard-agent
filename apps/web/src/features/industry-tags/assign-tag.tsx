import { useState } from "react";
import type { PositionSnapshot } from "@portfolio/domain";
import { restorePositionIndustry, setPositionIndustryTag } from "@/shared/api/portfolio";
import { usePortfolio } from "@/entities/portfolio/model";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
export function AssignTag({ token, position }: { token: string; position: PositionSnapshot }) {
  const { tags, refresh, setError } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(position.industryTagId ?? "");
  const [busy, setBusy] = useState(false);
  async function save(restore: boolean) {
    if (!restore && !selected) return;
    setBusy(true); setError(null);
    try {
      if (restore) await restorePositionIndustry(token, position.market, position.symbol);
      else await setPositionIndustryTag(token, position.market, position.symbol, selected);
      await refresh(); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存行业标签失败"); }
    finally { setBusy(false); }
  }
  return <><Card><CardHeader><CardTitle>我的行业标签</CardTitle><CardDescription>{position.industryTagged ? "用户标签优先于数据源，并参与概览聚合" : "当前使用数据源自动分类"}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div><strong className="text-xl">{position.industry ?? "未分类"}</strong><p className="mt-1 text-xs text-muted-foreground">数据源分类：{position.sourceIndustry ?? "暂无"}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy || tags.length === 0} onClick={() => { setSelected(position.industryTagId ?? ""); setOpen(true); }}>{tags.length ? "修改标签" : "请先创建标签"}</Button>{position.industryTagged && <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>恢复自动分类</Button>}</div></CardContent></Card><Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}><DialogContent><DialogTitle>选择行业标签</DialogTitle><DialogDescription className="mt-2 text-sm text-muted-foreground">标签会覆盖数据源自动行业，并立即用于概览行业聚合。</DialogDescription><div className="my-4 max-h-60 space-y-2 overflow-auto">{[...tags].sort((a,b) => a.sortOrder - b.sortOrder).map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="industry-tag" checked={selected === tag.id} onChange={() => setSelected(tag.id)} disabled={busy} /><span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}</label>)}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>取消</Button><Button disabled={!selected || busy} onClick={() => void save(false)}>{busy ? "保存中…" : "保存"}</Button></DialogFooter></DialogContent></Dialog></>;
}
