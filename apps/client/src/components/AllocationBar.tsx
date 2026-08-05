import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { formatPercent } from "@/utils/format";

interface AllocationBarProps {
  label: string;
  value: number;
  tone: "positive" | "negative";
}

export function AllocationBar({ label, value, tone }: AllocationBarProps) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text numberOfLines={1} style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatPercent(value)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: tone === "positive" ? colors.positiveDark : colors.negative,
              width: `${Math.min(Math.max(value * 100, 2), 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: colors.mutedDark, flex: 1, fontSize: 12, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 12, fontWeight: "800", marginLeft: 12 },
  track: { backgroundColor: colors.canvas, borderRadius: 999, height: 7, marginTop: 8, overflow: "hidden" },
  fill: { borderRadius: 999, height: "100%" },
});

