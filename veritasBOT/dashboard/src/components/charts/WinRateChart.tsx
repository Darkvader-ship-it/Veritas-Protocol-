/**
 * Win Rate Distribution Chart
 * Shows distribution of trader win rates as a bar chart
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Trader {
  address: string;
  winRate: number;
  tier: string;
}

interface WinRateChartProps {
  traders: Trader[];
}

export function WinRateChart({ traders }: WinRateChartProps) {
  // Create histogram buckets
  const buckets = [
    { range: '40-45%', min: 0.4, max: 0.45, count: 0 },
    { range: '45-50%', min: 0.45, max: 0.5, count: 0 },
    { range: '50-55%', min: 0.5, max: 0.55, count: 0 },
    { range: '55-60%', min: 0.55, max: 0.6, count: 0 },
    { range: '60-65%', min: 0.6, max: 0.65, count: 0 },
    { range: '65-70%', min: 0.65, max: 0.7, count: 0 },
    { range: '70%+', min: 0.7, max: 1, count: 0 },
  ];

  traders.forEach(trader => {
    const bucket = buckets.find(b => trader.winRate >= b.min && trader.winRate < b.max);
    if (bucket) bucket.count++;
  });

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2f3336" />
          <XAxis
            dataKey="range"
            stroke="#71767b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#71767b"
            fontSize={12}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f26',
              border: '1px solid #2f3336',
              borderRadius: '8px',
              color: '#e7e9ea',
            }}
            formatter={(value) => [`${value ?? 0} traders`, 'Count']}
          />
          <Bar dataKey="count" fill="#1d9bf0" radius={[4, 4, 0, 0]}>
            {buckets.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.min >= 0.6 ? '#00ba7c' : entry.min >= 0.5 ? '#1d9bf0' : '#f4212e'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WinRateChart;
