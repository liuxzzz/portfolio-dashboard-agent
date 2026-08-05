import { StyleSheet, Text, View } from "react-native";
import type { DataFreshness } from "@portfolio/domain";
import { colors } from "@/theme";

interface FreshnessBadgeProps {
  freshness: DataFreshness;
  demo: boolean;
}

const badgeCopy: Record<DataFreshness, string> = {
  fresh: "数据正常",
  stale: "数据过期",
  unknown: "时间未知",
};

export function FreshnessBadge({ freshness, demo }: FreshnessBadgeProps) {
  const isFresh = freshness === "fresh";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isFresh ? colors.accentSoft : colors.warningSoft },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: isFresh ? colors.positiveDark : colors.warning },
        ]}
      />
      <Text style={[styles.text, { color: isFresh ? colors.positiveDark : colors.warning }]}>
        {demo ? "演示数据" : badgeCopy[freshness]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  dot: { borderRadius: 999, height: 7, width: 7 },
  text: { fontSize: 11, fontWeight: "800" },
});

