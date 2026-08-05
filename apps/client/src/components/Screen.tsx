import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";

export function Screen({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 720 ? spacing.xl : spacing.md;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  container: { alignSelf: "center", maxWidth: 1040, width: "100%" },
});

