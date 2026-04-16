import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 13,
    }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>Week {label}</p>
      <p style={{ color: '#58a6ff', fontWeight: 600 }}>
        {payload[0].value} commit{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default function ActivityChart({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="section-title">Commit Activity (52 Weeks)</h3>
        <p className="empty">No commit activity data available.</p>
      </div>
    );
  }

  const totalCommits = activity.reduce((sum, w) => sum + w.commits, 0);

  return (
    <div className="chart-container">
      <h3 className="section-title">
        Commit Activity (52 Weeks) &mdash; {totalCommits.toLocaleString()} total
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#8b949e', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#21262d' }}
            interval={12}
            tickFormatter={(w) => `W${w}`}
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,0.08)' }} />
          <Bar dataKey="commits" fill="#58a6ff" radius={[3, 3, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
