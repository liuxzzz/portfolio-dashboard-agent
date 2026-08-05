import { dashboardPayloadSchema, type DashboardPayload } from "@portfolio/domain";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

export function hasConfiguredApi() {
  return Boolean(apiBaseUrl);
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  if (!apiBaseUrl) {
    throw new Error("API is not configured");
  }

  const response = await fetch(`${apiBaseUrl}/v1/dashboard`);
  if (!response.ok) {
    throw new Error(`Dashboard request failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  return dashboardPayloadSchema.parse(payload);
}

