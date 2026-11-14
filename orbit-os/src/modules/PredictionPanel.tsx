import { useEffect, useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { forecastSeries, poissonForecast, type Forecast, type SeriesPoint } from '../kernel';

interface Site { site: string; time: string[]; temp_max: number[]; temp_min: number[]; precip: number[]; soil: number[] }
interface DailyHistory { label: string; retrieved_at: string; sites: Site[]; earthquakes: { time: string[]; count: number[] } | null }

const VARS = [
  { id: 'temp_max', label: 'Max temperature', unit: '°C', color: '#fb923c', var: (s: Site) => s.temp_max },
  { id: 'soil', label: 'Soil moisture', unit: 'm³/m³', color: '#34d399', var: (s: Site) => s.soil },
  { id: 'precip', label: 'Precipitation', unit: 'mm', color: '#38bdf8', var: (s: Site) => s.precip },
] as const;

const toMonthly = (days: string[], vals: number[]): SeriesPoint[] => {
  const m = new Map<string, number[]>();
  days.forEach((d, i) => { if (vals[i] == null) return; const k = d.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)!).push(vals[i]); });
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, arr], i) => ({ x: i, y: arr.reduce((a, b) => a + b, 0) / arr.length }));
};

const DivBadge = ({ fc }: { fc: Forecast }) => (
  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${fc.divergence.level === 'elevated' ? 'bg-red-500/25 text-red-200' : fc.divergence.level === 'watch' ? 'bg-amber-500/25 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{fc.divergence.level.toUpperCase()} · z={fc.divergence.z.toFixed(1)}</span>
);

export function PredictionPanel() {
  const [h, setH] = useState<DailyHistory | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [siteIdx, setSiteIdx] = useState(0);
  const [varIdx, setVarIdx] = useState(0);

  useEffect(() => {
    fetch('/data/live/daily-history.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: DailyHistory) => setH(d))
      .catch((e) => setErr(String(e)));
  }, []);

  const site = h?.sites[siteIdx];
  const v = VARS[varIdx];
  const monthly = useMemo(() => (site ? toMonthly(site.time, v.var(site)) : []), [site, v]);
  const fc = useMemo(() => (monthly.length >= 24 ? forecastSeries(monthly, { horizon: 12, period: 12 }) : null), [monthly]);
  const eqFc = useMemo(() => (h?.earthquakes ? poissonForecast(h.earthquakes.count, { horizon: 30, window: 90 }) : null), [h]);

  if (err) return <Glass className="p-4 text-xs text-slate-500">6-year daily history unavailable ({err}). Run the collector + build-live.</Glass>;
  if (!h) return <Glass className="p-4 text-xs text-slate-500">Loading 6-year daily history…</Glass>;

  const eq = h.earthquakes;
  const eqPoints: SeriesPoint[] = eq ? eq.time.map((t, i) => ({ x: i, y: eq.count[i] })).slice(-365) : [];

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Icon name="ChartColumn" className="h-4 w-4 text-sky-300" /><span className="h-title">6-year daily history → prediction</span><StatusBadge status="live" note={h.retrieved_at.slice(0, 16).replace('T', ' ')} /></div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <select className="input !w-auto !py-1 text-xs" value={siteIdx} onChange={(e) => setSiteIdx(+e.target.value)}>{h.sites.map((s, i) => <option key={i} value={i}>{s.site}</option>)}</select>
          <select className="input !w-auto !py-1 text-xs" value={varIdx} onChange={(e) => setVarIdx(+e.target.value)}>{VARS.map((x, i) => <option key={x.id} value={i}>{x.label}</option>)}</select>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>Monthly {v.label} (6 y) → next 12 months</span>{fc ? <DivBadge fc={fc} /> : null}</div>
          <LineChart points={monthly} unit={v.unit} color={v.color} xLabel={(x) => (x % 12 === 0 ? `${20 + Math.floor(x / 12)}` : '')} />
          {fc && (
            <div className="mt-2 text-[11px] text-slate-300">
              <div>Trend: <b className="text-sky-300">{fc.slopePerStep >= 0 ? '+' : ''}{fc.slopePerStep.toFixed(3)} {v.unit}/mo</b> · next month ≈ <b className="text-white">{fc.expectedNext.toFixed(1)} {v.unit}</b> (95% band {fc.forecast[0]?.lo.toFixed(1)} → {fc.forecast[0]?.hi.toFixed(1)})</div>
              <div className="mt-1 flex flex-wrap gap-1">{fc.forecast.slice(0, 6).map((f, i) => <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-slate-400">m{i + 1}: {f.y.toFixed(1)}</span>)}</div>
              <p className="mt-1 text-slate-500">{fc.divergence.text} {fc.method}</p>
            </div>
          )}
          <p className="mt-1 text-[10px] text-slate-500">6 years × 365 days of Open-Meteo daily weather, aggregated monthly. Statistical forecast — not an official prediction.</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>M5+ earthquakes (daily, 6 y) → 30-day rate</span>{eqFc ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${eqFc.alert ? 'bg-red-500/25 text-red-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{eqFc.alert ? 'SURGE' : 'WITHIN EXPECTED'}</span> : null}</div>
          <LineChart points={eqPoints} unit="M5+/day" color="#f59e0b" xLabel={() => ''} />
          {eqFc && (
            <div className="mt-2 text-[11px] text-slate-300">
              <div>Trailing 90-day rate λ ≈ <b className="text-white">{eqFc.lambda.toFixed(2)}/day</b> · next 30 d expected ≈ <b className="text-white">{(eqFc.lambda * 30).toFixed(0)}</b> M5+ (95% upper {eqFc.upper.toFixed(1)}/day)</div>
              <p className="mt-1 text-slate-500">{eqFc.text}</p>
            </div>
          )}
          <p className="mt-1 text-[10px] text-slate-500">12,596 M5+ events over 6 years (USGS FDSN), Poisson rate forecast. Statistical only.</p>
        </div>
      </div>
    </Glass>
  );
}
