import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import type { InsightSeverity } from "@portfolio/domain";
import { Screen } from "@/components/Screen";
import { useDashboard } from "@/hooks/useDashboard";
import { colors, radii, spacing } from "@/theme";
import { formatTime } from "@/utils/format";

const severityStyle: Record<
  InsightSeverity,
  { background: string; foreground: string; icon: "information-circle" | "alert-circle" }
> = {
  info: { background: colors.infoSoft, foreground: colors.info, icon: "information-circle" },
  attention: { background: colors.warningSoft, foreground: colors.warning, icon: "alert-circle" },
  risk: { background: colors.negativeSoft, foreground: colors.negative, icon: "alert-circle" },
};

export default function AgentScreen() {
  const { data } = useDashboard();
  const run = data.latestAgentRun;

  return (
    <Screen>
      <Text style={styles.eyebrow}>EVIDENCE-FIRST AGENT</Text>
      <Text style={styles.title}>组合观察</Text>
      <Text style={styles.subtitle}>事实规则先行，模型解释后置，每条结论都能回到证据。</Text>

      <View style={styles.policyCard}>
        <View style={styles.policyIcon}>
          <Ionicons color={colors.ink} name="shield-checkmark-outline" size={22} />
        </View>
        <View style={styles.policyText}>
          <Text style={styles.policyTitle}>当前运行：确定性规则引擎</Text>
          <Text style={styles.policyBody}>
            只检查数据新鲜度、集中度和现金缓冲。尚未接入大模型，也不会生成买卖指令。
          </Text>
        </View>
      </View>

      <View style={styles.insightList}>
        {run?.insights.map((insight) => {
          const tone = severityStyle[insight.severity];

          return (
            <View key={insight.id} style={styles.insightCard}>
              <View style={[styles.insightIcon, { backgroundColor: tone.background }]}>
                <Ionicons color={tone.foreground} name={tone.icon} size={21} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightSummary}>{insight.summary}</Text>
                <View style={styles.evidenceRow}>
                  <Text style={styles.evidenceLabel}>证据</Text>
                  <Text style={styles.evidenceText}>{insight.evidence[0]?.label}</Text>
                  <Text style={styles.evidenceTime}>{formatTime(insight.evidence[0]?.asOf)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>{run?.disclaimer}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 7, maxWidth: 620 },
  policyCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.xl,
    flexDirection: "row",
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  policyIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  policyText: { flex: 1, marginLeft: spacing.md },
  policyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  policyBody: { color: colors.mutedDark, fontSize: 13, lineHeight: 20, marginTop: 6 },
  insightList: { gap: spacing.md, marginTop: spacing.md },
  insightCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    padding: spacing.lg,
  },
  insightIcon: {
    alignItems: "center",
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  insightContent: { flex: 1, marginLeft: spacing.md },
  insightTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  insightSummary: { color: colors.mutedDark, fontSize: 13, lineHeight: 21, marginTop: 7 },
  evidenceRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  evidenceLabel: {
    backgroundColor: colors.canvas,
    borderRadius: 999,
    color: colors.mutedDark,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  evidenceText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  evidenceTime: { color: colors.muted, fontSize: 11 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: spacing.lg },
});

