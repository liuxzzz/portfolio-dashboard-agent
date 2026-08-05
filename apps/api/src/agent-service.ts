import { analyzePortfolio } from "@portfolio/agent-core";
import type { AgentRun, PortfolioSnapshot } from "@portfolio/domain";

/**
 * Agent orchestration boundary. A future model-backed explanation layer must
 * consume the same validated snapshot and cannot access broker sessions.
 */
export interface PortfolioAgentService {
  run(snapshot: PortfolioSnapshot, now: Date): Promise<AgentRun>;
}

export class EvidenceFirstAgentService implements PortfolioAgentService {
  async run(snapshot: PortfolioSnapshot, now: Date) {
    return analyzePortfolio(snapshot, now);
  }
}
