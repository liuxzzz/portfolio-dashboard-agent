import { StyleSheet, Text, View } from "react-native";
import { AllocationBar } from "@/components/AllocationBar";
import { DonutChart } from "@/components/DonutChart";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { MetricCard } from "@/components/MetricCard";
import { Screen } from "@/components/Screen";
import { Section } from "@/components/Section";
import { Sparkline } from "@/components/Sparkline";
import { useDashboard } from "@/hooks/useDashboard";
import { colors, radii, spacing } from "@/theme";
import { formatCurrency, formatPercent, formatTime } from "@/utils/format";

export default function OverviewScreen() {
  const { data, isUsingDemo } = useDashboard();
  const { snapshot, industries, history } = data;
  const topPositions = [...snapshot.positions]
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 5);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>PORTFOLIO / TODAY</Text>
          <Text style={styles.title}>组合概览</Text>
          <Text style={styles.subtitle}>{snapshot.accountName}</Text>
        </View>
        <FreshnessBadge freshness={snapshot.freshness} demo={isUsingDemo} />
      </View>

      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroLabel}>总资产</Text>
          <Text style={styles.heroValue}>{formatCurrency(snapshot.totalAsset)}</Text>
        </View>
        <View style={styles.profitBlock}>
          <Text style={styles.profitLabel}>今日</Text>
          <Text
            style={[
              styles.profitValue,
              (snapshot.dayProfit ?? 0) >= 0 ? styles.positive : styles.negative,
            ]}
          >
            {formatCurrency(snapshot.dayProfit ?? 0, true)} · {formatPercent(snapshot.dayProfitRate, true)}
          </Text>
        </View>
        <Sparkline data={history.map((point) => point.totalAsset)} />
        <Text style={styles.syncText}>
          源数据同步于 {formatTime(snapshot.sourceSyncedAt)}
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          label="股票市值"
          value={formatCurrency(snapshot.stockMarketValue)}
          note={`${snapshot.positions.length} 只持仓`}
        />
        <MetricCard
          label="股票仓位"
          value={formatPercent(snapshot.positionRate)}
          note="按账户净资产计算"
        />
        <MetricCard
          label="现金"
          value={formatCurrency(snapshot.cash)}
          note={`${formatPercent(snapshot.cash / snapshot.totalAsset)} 现金占比`}
        />
      </View>

      <View style={styles.twoColumn}>
        <Section title="行业分布" subtitle="按最新市值">
          <DonutChart allocations={industries} />
        </Section>
        <Section title="个股集中度" subtitle="前五大持仓">
          <View style={styles.barList}>
            {topPositions.map((position) => (
              <AllocationBar
                key={position.symbol}
                label={position.name}
                value={position.portfolioWeight ?? 0}
                tone={(position.dayProfit ?? 0) >= 0 ? "positive" : "negative"}
              />
            ))}
          </View>
        </Section>
      </View>

      <Text style={styles.footnote}>
        本页先展示数据事实。所有分析都必须引用快照时间和证据，不直接生成交易指令。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginTop: 8,
  },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6 },
  heroCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.xl,
    overflow: "hidden",
  },
  heroLabel: { color: "#AEB7C7", fontSize: 13, fontWeight: "700" },
  heroValue: {
    color: colors.surface,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.5,
    marginTop: 8,
  },
  profitBlock: { marginTop: spacing.lg },
  profitLabel: { color: "#AEB7C7", fontSize: 12 },
  profitValue: { fontSize: 16, fontWeight: "800", marginTop: 5 },
  positive: { color: colors.positive },
  negative: { color: colors.negative },
  syncText: { color: "#8C98AB", fontSize: 12, marginTop: spacing.md },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  barList: { gap: spacing.md },
  footnote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: spacing.lg,
    paddingHorizontal: 4,
  },
});
