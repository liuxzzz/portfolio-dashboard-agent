import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

interface MetricCardProps {
  label: string;
  value: string;
  note: string;
}

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} style={styles.value}>{value}</Text>
      <Text numberOfLines={1} style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 210,
    flexGrow: 1,
    minHeight: 132,
    padding: spacing.lg,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 23, fontWeight: "800", marginTop: 14 },
  note: { color: colors.muted, fontSize: 11, marginTop: 9 },
});

