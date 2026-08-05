import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import type { ColorValue } from "react-native";
import { colors } from "@/theme";

type TabIconName = "grid-outline" | "list-outline" | "sparkles-outline";

function tabIcon(name: TabIconName) {
  return function Icon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons color={color} name={name} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "web" ? 66 : 84,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "概览", tabBarIcon: tabIcon("grid-outline") }}
      />
      <Tabs.Screen
        name="holdings"
        options={{ title: "持仓", tabBarIcon: tabIcon("list-outline") }}
      />
      <Tabs.Screen
        name="agent"
        options={{ title: "Agent", tabBarIcon: tabIcon("sparkles-outline") }}
      />
    </Tabs>
  );
}
