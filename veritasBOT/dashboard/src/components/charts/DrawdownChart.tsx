/**
 * Drawdown Chart
 * Shows portfolio drawdown over time (negative area chart)
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface DrawdownDataPoint {
  date: string;
  drawdown: number;
  portfolioValue: number;
}

interface DrawdownChartProps {
  data: DrawdownDataPoint[];
  maxDrawdown: number;
}

export function DrawdownChart({ data, maxDrawdown }: DrawdownChartProps) {
  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f4212e" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f4212e" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2f3336" />
          <XAxis
            dataKey="date"
            stroke="#71767b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#71767b"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            domain={[Math.min(-5, -maxDrawdown * 1.2), 0]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f26',
              border: '1px solid #2f3336',
              borderRadius: '8px',
              color: '#e7e9ea',
            }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`, 'Drawdown']}
          />
          <ReferenceLine y={-maxDrawdown} stroke="#f4212e" strokeDasharray="5 5" label={{ value: `Max: ${maxDrawdown.toFixed(1)}%`, fill: '#f4212e', fontSize: 10, position: 'right' }} />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#f4212e"
            strokeWidth={2}
            fill="url(#drawdownGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DrawdownChart;
