import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { colors } from "@/theme";

interface SparklineProps {
  data: number[];
}

const width = 520;
const height = 96;

export function Sparkline({ data }: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 14) - 7;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <View style={{ height, marginTop: 24, width: "100%" }}>
      <Svg height="100%" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} width="100%">
        <Polyline
          fill="none"
          points={points}
          stroke={colors.positive}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
      </Svg>
    </View>
  );
}

