import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

interface SectionProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: 390,
    flexGrow: 1,
    minHeight: 340,
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 6 },
  content: { flex: 1, justifyContent: "center", marginTop: spacing.lg },
});

