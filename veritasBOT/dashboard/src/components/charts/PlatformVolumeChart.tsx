/**
 * Platform Volume Pie Chart
 * Shows volume distribution across platforms
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PlatformStatus {
  platform: string;
  leaderboardCount: number;
  marketsCount: number;
  status: string;
}

interface PlatformVolumeChartProps {
  platforms: PlatformStatus[];
}

const PLATFORM_COLORS: Record<string, string> = {
  dreamdex: '#d4a017',
  polymarket: '#6366f1',
  azuro: '#22c55e',
  overtime: '#ef4444',
  limitless: '#8b5cf6',
  speedmarkets: '#f97316',
  sxbet: '#06b6d4',
  gnosis: '#10b981',
  drift: '#ec4899',
  kalshi: '#3b82f6',
  manifold: '#14b8a6',
  metaculus: '#a855f7',
};

export function PlatformVolumeChart({ platforms }: PlatformVolumeChartProps) {
  const data = platforms
    .filter(p => p.status === 'ok' && p.leaderboardCount > 0)
    .map(p => ({
      name: p.platform,
      value: p.leaderboardCount,
      markets: p.marketsCount,
    }));

  if (data.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center text-muted">
        No active platforms
      </div>
    );
  }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PLATFORM_COLORS[entry.name] || '#71767b'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f26',
              border: '1px solid #2f3336',
              borderRadius: '8px',
              color: '#e7e9ea',
            }}
            formatter={(value, name) => [`${value ?? 0} traders`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            formatter={(value) => <span style={{ color: '#e7e9ea' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PlatformVolumeChart;
