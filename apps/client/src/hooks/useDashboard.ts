import { useQuery } from "@tanstack/react-query";
import { demoDashboard } from "@/fixtures/demo";
import { fetchDashboard, hasConfiguredApi } from "@/services/api";

export function useDashboard() {
  const apiConfigured = hasConfiguredApi();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    enabled: apiConfigured,
  });

  return {
    ...query,
    data: query.data ?? demoDashboard,
    isUsingDemo: !apiConfigured || query.isError,
  };
}
