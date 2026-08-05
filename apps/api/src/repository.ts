import type {
  AgentRun,
  PortfolioHistoryPoint,
  PortfolioSnapshot,
} from "@portfolio/domain";

export interface PortfolioRepository {
  saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
  saveAgentRun(run: AgentRun): Promise<void>;
  getLatestSnapshot(accountId?: string): Promise<PortfolioSnapshot | null>;
  getLatestAgentRun(snapshotId: string): Promise<AgentRun | null>;
  getHistory(accountId: string, limit: number): Promise<PortfolioHistoryPoint[]>;
}

export class MemoryPortfolioRepository implements PortfolioRepository {
  private readonly snapshots = new Map<string, PortfolioSnapshot>();
  private readonly runs = new Map<string, AgentRun>();

  async saveSnapshot(snapshot: PortfolioSnapshot) {
    this.snapshots.set(snapshot.id, snapshot);
  }

  async saveAgentRun(run: AgentRun) {
    this.runs.set(run.snapshotId, run);
  }

  async getLatestSnapshot(accountId?: string) {
    return (
      [...this.snapshots.values()]
        .filter(
          (snapshot) =>
            accountId === undefined || snapshot.sourceAccountId === accountId,
        )
        .sort((left, right) =>
          right.capturedAt.localeCompare(left.capturedAt),
        )[0] ?? null
    );
  }

  async getLatestAgentRun(snapshotId: string) {
    return this.runs.get(snapshotId) ?? null;
  }

  async getHistory(accountId: string, limit: number) {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.sourceAccountId === accountId)
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
      .slice(-limit)
      .map((snapshot) => ({
        date: snapshot.capturedAt.slice(0, 10),
        totalAsset: snapshot.totalAsset,
        positionRate: snapshot.positionRate,
      }));
  }
}
