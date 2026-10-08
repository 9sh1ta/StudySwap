import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import useTokens from '../../hooks/useTokens.js';
import { monthLabel } from '../../lib/format.js';

// The app's only two charts. Stripped: no grid, 1px rule axes, one accent
// series, mono ticks, no gradients, square bar ends.
function useChartStyle() {
  const t = useTokens(['--accent', '--rule', '--rule-strong', '--ink-3', '--ink', '--paper-raised', '--font-mono']);
  const tick = { fill: t['ink-3'], fontFamily: t['font-mono'], fontSize: 11 };
  const axis = { stroke: t['rule-strong'], strokeWidth: 1 };
  const tooltip = {
    contentStyle: { background: t['paper-raised'], border: `1px solid ${t['rule-strong']}`, borderRadius: 2, fontFamily: t['font-mono'], fontSize: 12, color: t.ink, padding: '6px 8px' },
    labelStyle: { color: t['ink-3'] },
    itemStyle: { color: t.ink, padding: 0 },
    cursor: { stroke: t.rule, fill: t.rule, fillOpacity: 0.4 },
  };
  return { t, tick, axis, tooltip };
}

export function CredibilityTrendChart({ data }) {
  const { t, tick, axis, tooltip } = useChartStyle();
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const summary = rows.map((d) => `${d.label}: ${d.credibility_score ?? 'no ratings'}`).join(', ');
  return (
    <figure className="chart" aria-label={`Credibility by month — ${summary}`}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <XAxis dataKey="label" tick={tick} axisLine={axis} tickLine={false} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={tick} axisLine={axis} tickLine={false} />
          <RTooltip {...tooltip} formatter={(v, _n, p) => [v === null ? '—' : Number(v).toFixed(2), `AVG over ${p.payload.rating_count}`]} />
          <Line type="linear" dataKey="credibility_score" stroke={t.accent} strokeWidth={1.5} dot={{ r: 2.5, fill: t.accent, strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function ScoreDistributionChart({ ratings }) {
  const { t, tick, axis, tooltip } = useChartStyle();
  const rows = [1, 2, 3, 4, 5].map((s) => ({ score: `${s}★`, count: ratings.filter((r) => r.score === s).length }));
  return (
    <figure className="chart" aria-label={`Ratings by score — ${rows.map((r) => `${r.score}: ${r.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <XAxis dataKey="score" tick={tick} axisLine={axis} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick} axisLine={axis} tickLine={false} />
          <RTooltip {...tooltip} formatter={(v) => [v, 'ratings']} />
          <Bar dataKey="count" fill={t.accent} radius={0} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
