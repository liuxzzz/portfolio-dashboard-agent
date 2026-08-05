import type {
  AgentInsight,
  AgentRun,
  PortfolioSnapshot,
} from "@portfolio/domain";

export interface AgentPolicy {
  staleAfterHours: number;
  singlePositionAttention: number;
  singlePositionRisk: number;
  minimumCashRate: number;
}

export const defaultAgentPolicy: AgentPolicy = {
  staleAfterHours: 36,
  singlePositionAttention: 0.2,
  singlePositionRisk: 0.3,
  minimumCashRate: 0.05,
};

const disclaimer =
  "以下内容用于整理持仓事实和风险线索，不构成证券选择、买卖时机或收益承诺。";

export function analyzePortfolio(
  snapshot: PortfolioSnapshot,
  now = new Date(),
  policy: AgentPolicy = defaultAgentPolicy,
): AgentRun {
  const createdAt = now.toISOString();
  const insights: AgentInsight[] = [];
  const snapshotEvidence = {
    kind: "snapshot" as const,
    referenceId: snapshot.id,
    label: `持仓快照 · ${snapshot.accountName}`,
    asOf: snapshot.capturedAt,
  };

  if (snapshot.sourceSyncedAt) {
    const sourceAgeHours =
      (now.getTime() - new Date(snapshot.sourceSyncedAt).getTime()) / 3_600_000;

    if (sourceAgeHours > policy.staleAfterHours) {
      insights.push({
        id: `${snapshot.id}:freshness`,
        category: "freshness",
        severity: "risk",
        title: "源数据可能已经过期",
        summary: `同花顺最近同步时间距今约 ${Math.floor(sourceAgeHours)} 小时。先同步账户，再解释组合变化。`,
        confidence: 1,
        evidence: [snapshotEvidence],
        createdAt,
      });
    }
  }

  const sortedPositions = [...snapshot.positions].sort(
    (left, right) =>
      (right.portfolioWeight ?? 0) - (left.portfolioWeight ?? 0),
  );
  const largest = sortedPositions[0];

  if (
    largest?.portfolioWeight !== null &&
    largest?.portfolioWeight !== undefined &&
    largest.portfolioWeight >= policy.singlePositionAttention
  ) {
    insights.push({
      id: `${snapshot.id}:concentration:${largest.symbol}`,
      category: "concentration",
      severity:
        largest.portfolioWeight >= policy.singlePositionRisk ? "risk" : "attention",
      title: "单一持仓集中度较高",
      summary: `${largest.name} 占组合 ${(largest.portfolioWeight * 100).toFixed(1)}%，是当前最大的单一个股暴露。`,
      confidence: 1,
      evidence: [
        {
          kind: "position",
          referenceId: `${snapshot.id}:${largest.symbol}`,
          label: `${largest.name} 仓位`,
          asOf: snapshot.capturedAt,
        },
      ],
      createdAt,
    });
  }

  const cashRate = snapshot.totalAsset === 0 ? 0 : snapshot.cash / snapshot.totalAsset;
  if (cashRate < policy.minimumCashRate) {
    insights.push({
      id: `${snapshot.id}:cash`,
      category: "cash",
      severity: "attention",
      title: "现金缓冲较低",
      summary: `现金约占总资产 ${(cashRate * 100).toFixed(1)}%。这是流动性事实提示，不代表需要调仓。`,
      confidence: 1,
      evidence: [snapshotEvidence],
      createdAt,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `${snapshot.id}:note`,
      category: "note",
      severity: "info",
      title: "暂未发现需要优先提醒的组合信号",
      summary: "当前规则只检查数据新鲜度、单股集中度和现金缓冲。",
      confidence: 1,
      evidence: [snapshotEvidence],
      createdAt,
    });
  }

  return {
    id: `run:${snapshot.id}:${now.getTime()}`,
    snapshotId: snapshot.id,
    status: "completed",
    requestedAt: createdAt,
    completedAt: createdAt,
    model: null,
    insights,
    disclaimer,
  };
}

