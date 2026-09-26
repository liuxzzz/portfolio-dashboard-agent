import { usePortfolio } from "@/entities/portfolio/model";
import { PageHeading } from "@/entities/portfolio/ui";
import { ManageTags } from "@/features/industry-tags/manage-tags";
import { ImportPortfolio } from "@/features/import-portfolio/ui";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
export function ProfilePage({ phone, token, onLogout }: { phone: string; token: string; onLogout: () => void }) {
  const { dashboard, refresh } = usePortfolio();
  return <><PageHeading eyebrow="ACCOUNT" title="我的" description="账户、数据导入与行业标签管理" /><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-4"><Card><CardHeader><CardTitle>{phone}</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">持仓、历史记录、行业标签和 Agent 观察均按此账户隔离。</p>{!dashboard && <Button variant="outline" className="mr-2" onClick={() => void refresh()}>重新加载组合</Button>}<Button variant="outline" onClick={onLogout}>退出登录</Button></CardContent></Card><ImportPortfolio token={token} /></div><ManageTags token={token} /></div></>;
}
