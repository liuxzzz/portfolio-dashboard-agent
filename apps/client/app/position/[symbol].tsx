import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricCard } from "@/components/MetricCard";
import { Screen } from "@/components/Screen";
import { useDashboard } from "@/hooks/useDashboard";
import { colors, radii, spacing } from "@/theme";
import { formatCurrency, formatPercent, formatTime } from "@/utils/format";

export default function PositionDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { data } = useDashboard();
  const position = data.snapshot.positions.find((item) => item.symbol === symbol);

  if (!position) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.ink} name="arrow-back" size={20} />
        </Pressable>
        <Text style={styles.title}>没有找到这条持仓</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color={colors.ink} name="arrow-back" size={20} />
      </Pressable>

      <Text style={styles.eyebrow}>{position.market} · {position.symbol}</Text>
      <Text style={styles.title}>{position.name}</Text>
      <Text style={styles.subtitle}>{position.industry ?? "未分类行业"}</Text>

      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>最新价</Text>
        <Text style={styles.price}>{formatCurrency(position.currentPrice)}</Text>
        <Text style={styles.timestamp}>快照时间 {formatTime(data.snapshot.capturedAt)}</Text>
      </View>

      <View style={styles.grid}>
        <MetricCard label="持有金额" value={formatCurrency(position.marketValue)} note={formatPercent(position.portfolioWeight)} />
        <MetricCard label="持有盈亏" value={formatCurrency(position.holdingProfit, true)} note={formatPercent(position.holdingProfitRate, true)} />
        <MetricCard label="单位成本" value={formatCurrency(position.unitCost)} note={`${position.holdingDays ?? "—"} 个持仓日`} />
      </View>

      <View style={styles.evidenceCard}>
        <Text style={styles.evidenceTitle}>数据证据</Text>
        <Text style={styles.evidenceBody}>
          数量、成本和持仓天数来自账户持仓接口；最新价来自行情接口；市值、仓位和盈亏由标准化计算层生成。
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.xl,
    width: 44,
  },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 7 },
  priceCard: { backgroundColor: colors.ink, borderRadius: radii.xl, marginTop: spacing.xl, padding: spacing.xl },
  priceLabel: { color: "#AEB7C7", fontSize: 12 },
  price: { color: colors.surface, fontSize: 36, fontWeight: "800", marginTop: 7 },
  timestamp: { color: "#8C98AB", fontSize: 11, marginTop: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  evidenceCard: { backgroundColor: colors.accentSoft, borderRadius: radii.lg, marginTop: spacing.md, padding: spacing.lg },
  evidenceTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  evidenceBody: { color: colors.mutedDark, fontSize: 13, lineHeight: 21, marginTop: 8 },
});
