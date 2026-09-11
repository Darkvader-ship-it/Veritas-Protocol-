/**
 * Signal History Chart
 * Shows consensus signals over time
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Signal {
  epoch: number;
  consensus: string;
  confidence: number;
  weightedBullPercent: number;
  timestamp: string;
}

interface SignalHistoryChartProps {
  signals: Signal[];
}

export function SignalHistoryChart({ signals }: SignalHistoryChartProps) {
  const data = signals.map(signal => ({
    epoch: signal.epoch,
    bullPercent: signal.weightedBullPercent,
    confidence: signal.confidence,
    time: new Date(signal.timestamp).toLocaleTimeString(),
    consensus: signal.consensus,
  })).reverse();

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="bullGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ba7c" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00ba7c" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2f3336" />
          <XAxis
            dataKey="epoch"
            stroke="#71767b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#71767b"
            fontSize={12}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1f26',
              border: '1px solid #2f3336',
              borderRadius: '8px',
              color: '#e7e9ea',
            }}
            formatter={(value, name) => {
              const v = Number(value ?? 0)
              if (name === 'bullPercent') return [`${v.toFixed(1)}%`, 'Bull %'];
              return [`${v.toFixed(1)}%`, 'Confidence'];
            }}
          />
          <ReferenceLine y={50} stroke="#71767b" strokeDasharray="5 5" />
          <Area
            type="monotone"
            dataKey="bullPercent"
            stroke="#00ba7c"
            strokeWidth={2}
            fill="url(#bullGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SignalHistoryChart;
