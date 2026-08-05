import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { useDashboard } from "@/hooks/useDashboard";
import { colors, radii, spacing } from "@/theme";
import { formatCurrency, formatPercent } from "@/utils/format";

export default function HoldingsScreen() {
  const { data } = useDashboard();
  const positions = [...data.snapshot.positions].sort(
    (left, right) => right.marketValue - left.marketValue,
  );

  return (
    <Screen>
      <Text style={styles.eyebrow}>POSITIONS</Text>
      <Text style={styles.title}>全部持仓</Text>
      <Text style={styles.subtitle}>按最新市值排序 · 点击查看证据详情</Text>

      <View style={styles.list}>
        {positions.map((position) => {
          const isPositive = (position.dayProfit ?? 0) >= 0;

          return (
            <Link
              key={position.symbol}
              href={{ pathname: "/position/[symbol]", params: { symbol: position.symbol } }}
              asChild
            >
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.symbolBox}>
                  <Text style={styles.symbol}>{position.symbol.slice(-4)}</Text>
                </View>
                <View style={styles.nameBlock}>
                  <Text style={styles.name}>{position.name}</Text>
                  <Text style={styles.meta}>
                    {position.industry ?? "未分类"} · {formatPercent(position.portfolioWeight)}
                  </Text>
                </View>
                <View style={styles.valueBlock}>
                  <Text style={styles.value}>{formatCurrency(position.marketValue)}</Text>
                  <Text style={[styles.change, isPositive ? styles.marketUp : styles.marketDown]}>
                    {formatPercent(position.dayProfitRate, true)}
                  </Text>
                </View>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 7 },
  list: { gap: 10, marginTop: spacing.xl },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 82,
    padding: spacing.md,
  },
  pressed: { opacity: 0.75 },
  symbolBox: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  symbol: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  nameBlock: { flex: 1, marginLeft: spacing.md },
  name: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  valueBlock: { alignItems: "flex-end" },
  value: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  change: { fontSize: 12, fontWeight: "800", marginTop: 6 },
  marketUp: { color: colors.marketUp },
  marketDown: { color: colors.marketDown },
});
