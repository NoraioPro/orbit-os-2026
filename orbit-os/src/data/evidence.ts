import { fmt, signed, trend, zScoreOutliers, type EvidencePack } from '../kernel';
import { POWER_VARS, type PowerSeries } from './power';

export function trendEvidence(s: PowerSeries, windowYears = 5): EvidencePack {
  const v = POWER_VARS[s.variable];
  const tr = trend(s.annual, windowYears);
  const out = zScoreOutliers(s.annual, 2);
  const level = tr.n < 8 ? 'low' : tr.mkP < 0.01 ? 'high' : tr.mkP < 0.05 ? 'medium' : 'low';
  const decade = tr.theilSen * 10;
  return {
    id: `trend:${s.variable}:${s.place.name}:${s.from}-${s.to}`,
    title: `${s.place.name.split(' (')[0]} · ${v.short.toLowerCase()} trend`,
    subtitle: v.label,
    kind: 'trend',
    status: s.status,
    sources: [{ name: `NASA POWER · ${s.variable}`, url: s.url, retrieved: s.retrieved }],
    window: { start: String(s.from), end: String(s.to), label: 'annual means' },
    location: { name: s.place.name, lat: s.place.lat, lon: s.place.lon },
    confidence: {
      level, score: level === 'high' ? 0.88 : level === 'medium' ? 0.66 : 0.38,
      rationale: `Mann-Kendall z=${fmt(tr.mkZ, 2)}, p=${tr.mkP < 0.001 ? '<0.001' : fmt(tr.mkP, 3)} over n=${tr.n} years. ${tr.significant ? 'Monotonic trend is statistically significant at 5%.' : 'Not significant at 5%: treat as no clear trend.'}`,
    },
    method: 'Annual means from NASA POWER monthly point data → Theil-Sen slope (robust) + OLS fit + Mann-Kendall test; first vs last window means.',
    metrics: [
      { label: 'Theil-Sen slope', value: `${signed(decade, 2)} ${v.unit}/decade`, status: s.status },
      { label: `Mean first ${windowYears} y`, value: `${fmt(tr.firstMean, 2)} ${v.unit}`, status: s.status },
      { label: `Mean last ${windowYears} y`, value: `${fmt(tr.lastMean, 2)} ${v.unit}`, status: s.status },
      { label: 'Change', value: s.variable === 'T2M' ? `${signed(tr.delta, 2)} ${v.unit}` : `${signed(tr.delta, 2)} ${v.unit} (${signed(tr.deltaPct, 1)}%)`, status: s.status },
      { label: 'Outlier years (|z|≥2)', value: out.length ? out.map((o) => `${o.x}`).join(', ') : 'none', status: s.status },
    ],
    series: { label: v.short, unit: v.unit, points: s.annual, trend: { slope: tr.olsSlope, intercept: tr.intercept } },
    limitations: [
      v.note,
      'Point value of a ~0.5° reanalysis grid cell; not a station measurement.',
      ...(s.note ? [s.note] : []),
    ],
    patterns: ['change', 'anomaly', 'review'],
    createdAt: new Date().toISOString(),
  };
}
