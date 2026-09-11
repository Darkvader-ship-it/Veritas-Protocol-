/**
 * Equity Curve Chart
 * Shows portfolio value over time from backtest results
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Trade {
  epoch: number;
  timestamp: string;
  portfolioValueAfter: number;
  won: boolean;
  pnl: number;
}

interface EquityCurveProps {
  trades: Trade[];
  initialCapital: number;
}

export function EquityCurve({ trades, initialCapital }: EquityCurveProps) {
  const data = [
    { date: 'Start', value: initialCapital, index: 0 },
    ...trades.map((trade, index) => ({
      date: new Date(trade.timestamp).toLocaleDateString(),
      value: trade.portfolioValueAfter,
      index: index + 1,
      won: trade.won,
      pnl: trade.pnl,
    })),
  ];

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2f3336" />
          <XAxis
            dataKey="date"
            stroke="#71767b"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#71767b"
            fontSize={12}
            tickLine={false}
            domain={[minValue * 0.95, maxValue * 1.05]}
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f26',
              border: '1px solid #2f3336',
              borderRadius: '8px',
              color: '#e7e9ea',
            }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(4)} STT`, 'Portfolio Value']}
          />
          <ReferenceLine y={initialCapital} stroke="#71767b" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1d9bf0"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#1d9bf0' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EquityCurve;
