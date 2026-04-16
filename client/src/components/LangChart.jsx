import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = [
  '#58a6ff', '#3fb950', '#f78166', '#d2a8ff', '#ffa657',
  '#79c0ff', '#56d364', '#ff7b72', '#bc8cff', '#ffb454',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, percent } = payload[0].payload;
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 13,
    }}>
      <p style={{ color: '#c9d1d9', fontWeight: 600 }}>{name}</p>
      <p style={{ color: '#8b949e' }}>{percent}%</p>
    </div>
  );
};

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 8 }}>
      {payload.map((entry, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b949e' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
          {entry.value} <span style={{ color: '#6e7681' }}>({entry.payload.percent}%)</span>
        </li>
      ))}
    </ul>
  );
};

export default function LangChart({ languages }) {
  if (!languages || Object.keys(languages).length === 0) {
    return (
      <div className="chart-container">
        <h3 className="section-title">Languages Used</h3>
        <p className="empty">No language data available.</p>
      </div>
    );
  }

  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  const data = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, bytes]) => ({
      name,
      value: bytes,
      percent: ((bytes / total) * 100).toFixed(1),
    }));

  return (
    <div className="chart-container">
      <h3 className="section-title">Languages Used</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
