import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { IndustryAllocation } from "@portfolio/domain";
import { colors, spacing } from "@/theme";
import { formatPercent } from "@/utils/format";

interface DonutChartProps {
  allocations: IndustryAllocation[];
}

const size = 150;
const strokeWidth = 20;
const radius = (size - strokeWidth) / 2;
const circumference = 2 * Math.PI * radius;

export function DonutChart({ allocations }: DonutChartProps) {
  let offset = 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartWrapper}>
        <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={colors.canvas}
            strokeWidth={strokeWidth}
          />
          {allocations.map((allocation) => {
            const segment = circumference * allocation.weight;
            const dashOffset = -offset;
            offset += segment;

            return (
              <Circle
                key={allocation.name}
                cx={size / 2}
                cy={size / 2}
                fill="none"
                origin={`${size / 2}, ${size / 2}`}
                r={radius}
                rotation="-90"
                stroke={allocation.color}
                strokeDasharray={[segment, circumference - segment]}
                strokeDashoffset={dashOffset}
                strokeWidth={strokeWidth}
              />
            );
          })}
        </Svg>
        <View pointerEvents="none" style={styles.centerLabel}>
          <Text style={styles.centerValue}>{allocations.length}</Text>
          <Text style={styles.centerText}>个行业</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {allocations.slice(0, 5).map((allocation) => (
          <View key={allocation.name} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: allocation.color }]} />
            <Text numberOfLines={1} style={styles.legendName}>{allocation.name}</Text>
            <Text style={styles.legendValue}>{formatPercent(allocation.weight)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", flexDirection: "row", gap: spacing.lg, justifyContent: "center" },
  chartWrapper: { height: size, width: size },
  centerLabel: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 },
  centerValue: { color: colors.ink, fontSize: 25, fontWeight: "800" },
  centerText: { color: colors.muted, fontSize: 10, marginTop: 2 },
  legend: { flex: 1, gap: 11, maxWidth: 210 },
  legendRow: { alignItems: "center", flexDirection: "row" },
  legendDot: { borderRadius: 999, height: 8, width: 8 },
  legendName: { color: colors.mutedDark, flex: 1, fontSize: 11, marginLeft: 8 },
  legendValue: { color: colors.ink, fontSize: 11, fontWeight: "800" },
});

