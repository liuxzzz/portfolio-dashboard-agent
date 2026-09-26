import { dashboardPayloadSchema, type DashboardPayload } from "@portfolio/domain";
const keyFor = (userId: string) => `portfolio-web-dashboard-v1:${userId}`;
export function readDashboardCache(userId: string): DashboardPayload | null {
  try {
    const raw = sessionStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = dashboardPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export function saveDashboardCache(userId: string, dashboard: DashboardPayload): void {
  try { sessionStorage.setItem(keyFor(userId), JSON.stringify(dashboard)); }
  catch { /* Storage can be disabled without blocking the live dashboard. */ }
}
export function clearDashboardCache(userId: string): void {
  try { sessionStorage.removeItem(keyFor(userId)); } catch { /* Ignore disabled storage. */ }
}
