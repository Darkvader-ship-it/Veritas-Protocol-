/**
 * Trend Sparkline
 * Mini inline chart showing trend velocity over time
 */

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface TrendSparklineProps {
  data: number[];  // Array of velocity values
  color?: string;
  height?: number;
}

export function TrendSparkline({ data, color = '#1d9bf0', height = 24 }: TrendSparklineProps) {
  // Normalize data for sparkline
  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  // Determine color based on trend direction
  const lastValue = data[data.length - 1] || 0;
  const firstValue = data[0] || 0;
  const trendColor = lastValue > firstValue ? '#00ba7c' : lastValue < firstValue ? '#f4212e' : color;

  if (data.length < 2) {
    return (
      <div className="w-12 h-6 flex items-center justify-center text-muted text-xs">
        --
      </div>
    );
  }

  return (
    <div className="w-16" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={trendColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TrendSparkline;
