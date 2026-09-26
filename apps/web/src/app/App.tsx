import { useCallback, useEffect, useState } from "react";
import { ApiError, checkHealth, clearSession, getCurrentUser, readSession, revokeSession, saveSession, type Session } from "@/shared/api/portfolio";
import { PortfolioProvider, usePortfolio } from "@/entities/portfolio/model";
import { clearDashboardCache } from "@/entities/portfolio/cache";
import { LoginPage } from "@/pages/login/ui";
import { OverviewPage } from "@/pages/overview/ui";
import { HoldingsPage } from "@/pages/holdings/ui";
import { PositionPage } from "@/pages/position/ui";
import { AgentPage } from "@/pages/agent/ui";
import { ProfilePage } from "@/pages/profile/ui";
import { Shell, type Page } from "@/widgets/shell/ui";

type Route = { page: Page; symbol?: string };
function readRoute(): Route {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash.startsWith("/position/")) return { page: "position", symbol: hash.slice(10) };
  if (hash === "/holdings" || hash === "/agent" || hash === "/profile") return { page: hash.slice(1) as Page };
  return { page: "overview" };
}
export function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [health, setHealth] = useState("checking");
  const logout = useCallback(() => { if (session) clearDashboardCache(session.user.id); clearSession(); setSession(null); }, [session]);
  useEffect(() => {
    let active = true;
    async function probe() { const ok = await checkHealth(); if (active) setHealth(ok ? "ready" : "offline"); }
    void probe(); const timer = window.setInterval(() => void probe(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    void getCurrentUser(session.accessToken).catch((cause) => { if (active && cause instanceof ApiError && cause.status === 401) logout(); });
    return () => { active = false; };
  }, [session, logout]);
  function login(next: Session) { saveSession(next); setSession(next); }
  return session ? <PortfolioProvider key={session.user.id} token={session.accessToken} userId={session.user.id} onUnauthorized={logout}><AuthenticatedApp session={session} health={health} onLogout={logout} /></PortfolioProvider> : <LoginPage onLogin={login} health={health} />;
}
function AuthenticatedApp({ session, health, onLogout }: { session: Session; health: string; onLogout: () => void }) {
  const [route, setRoute] = useState<Route>(readRoute);
  const [visible, setVisible] = useState(false);
  const { error, setError, refresh } = usePortfolio();
  useEffect(() => { const handler = () => setRoute(readRoute()); window.addEventListener("hashchange", handler); return () => window.removeEventListener("hashchange", handler); }, []);
  function navigate(page: Page, symbol?: string) { window.location.hash = page === "position" && symbol ? `/position/${encodeURIComponent(symbol)}` : `/${page}`; setRoute(readRoute()); window.scrollTo(0,0); }
  async function logout() { try { await revokeSession(session.accessToken); } catch { /* Clear the local session even when the API is unavailable. */ } onLogout(); }
  let content;
  if (route.page === "holdings") content = <HoldingsPage visible={visible} onOpenPosition={(symbol) => navigate("position", symbol)} />;
  else if (route.page === "position") content = <PositionPage token={session.accessToken} symbol={route.symbol ?? ""} visible={visible} onBack={() => navigate("holdings")} />;
  else if (route.page === "agent") content = <AgentPage token={session.accessToken} />;
  else if (route.page === "profile") content = <ProfilePage phone={session.user.phone} token={session.accessToken} onLogout={() => void logout()} />;
  else content = <OverviewPage visible={visible} onOpenPosition={(symbol) => navigate("position", symbol)} />;
  return <Shell page={route.page} onNavigate={navigate} phone={session.user.phone} health={health} amountsVisible={visible} onToggleAmounts={() => setVisible((value) => !value)} onRefresh={() => void refresh()} onLogout={() => void logout()}>{error && <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="关闭提示">×</button></div>}{content}</Shell>;
}
