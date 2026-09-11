/**
 * Risk Score Gauge
 * Radial gauge showing wallet risk score
 */

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RiskScoreGaugeProps {
  score: number; // 0-100
  label?: string;
}

export function RiskScoreGauge({ score, label: _label = 'Risk Score' }: RiskScoreGaugeProps) {
  const data = [
    { name: 'score', value: score },
    { name: 'remaining', value: 100 - score },
  ];

  const getColor = (score: number) => {
    if (score < 25) return '#00ba7c'; // Low risk - green
    if (score < 50) return '#ffd400'; // Medium risk - yellow
    if (score < 75) return '#f97316'; // High risk - orange
    return '#f4212e'; // Critical - red
  };

  const getRiskLabel = (score: number) => {
    if (score < 25) return 'Low';
    if (score < 50) return 'Medium';
    if (score < 75) return 'High';
    return 'Critical';
  };

  return (
    <div className="relative w-full h-32">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius={50}
            outerRadius={65}
            paddingAngle={0}
            dataKey="value"
          >
            <Cell fill={getColor(score)} />
            <Cell fill="#2f3336" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-2xl font-bold" style={{ color: getColor(score) }}>
          {score}
        </span>
        <span className="text-xs text-muted">{getRiskLabel(score)}</span>
      </div>
    </div>
  );
}

export default RiskScoreGauge;
