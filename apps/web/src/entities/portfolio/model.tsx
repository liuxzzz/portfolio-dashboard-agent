import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DashboardPayload, IndustryTag } from "@portfolio/domain";
import { ApiError, getDashboard, getIndustryTags } from "@/shared/api/portfolio";
import { readDashboardCache, saveDashboardCache, clearDashboardCache } from "./cache";

type PortfolioContextValue = {
  dashboard: DashboardPayload | null;
  tags: IndustryTag[];
  source: "remote" | "cache" | null;
  loading: boolean;
  missingSnapshot: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshTags: () => Promise<void>;
  setError: (message: string | null) => void;
};
const PortfolioContext = createContext<PortfolioContextValue | null>(null);
export function PortfolioProvider({ token, userId, onUnauthorized, children }: { token: string; userId: string; onUnauthorized: () => void; children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(() => readDashboardCache(userId));
  const [source, setSource] = useState<"remote" | "cache" | null>(() => readDashboardCache(userId) ? "cache" : null);
  const [tags, setTags] = useState<IndustryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingSnapshot, setMissingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getDashboard(token);
      setDashboard(payload);
      setSource("remote");
      saveDashboardCache(userId, payload);
      setTags(payload.industryTags);
      setMissingSnapshot(false);
      setError(payload.industryData?.status !== "fresh" ? payload.industryData?.message ?? null : null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { clearDashboardCache(userId); onUnauthorized(); return; }
      if (cause instanceof ApiError && cause.code === "snapshot_not_found") {
        const cached = readDashboardCache(userId);
        if (cached) { setDashboard(cached); setSource("cache"); setError("服务端暂无快照，当前展示本机缓存。"); }
        else { setDashboard(null); setSource(null); setMissingSnapshot(true); setError(null); }
      } else {
        const cached = readDashboardCache(userId);
        if (cached) { setDashboard(cached); setSource("cache"); setError("后端暂时不可用，当前展示本机缓存。"); }
        else setError(cause instanceof Error ? cause.message : "组合加载失败");
      }
    } finally { setLoading(false); }
  }, [token, userId, onUnauthorized]);
  const refreshTags = useCallback(async () => {
    try { setTags(await getIndustryTags(token)); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      else setError(cause instanceof Error ? cause.message : "标签加载失败");
    }
  }, [token, onUnauthorized]);
  useEffect(() => { void refresh(); void refreshTags(); }, [refresh, refreshTags]);
  return <PortfolioContext.Provider value={{ dashboard, tags, source, loading, missingSnapshot, error, refresh, refreshTags, setError }}>{children}</PortfolioContext.Provider>;
}
export function usePortfolio() {
  const value = useContext(PortfolioContext);
  if (!value) throw new Error("PortfolioProvider is missing");
  return value;
}
