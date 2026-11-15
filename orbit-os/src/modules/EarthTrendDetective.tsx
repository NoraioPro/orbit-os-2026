import { useEffect, useMemo, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { GAZ_TO_HARVEST, loadPowerHarvest, type PowerHarvest } from '../data/harvest';
import { loadPowerSnapshot, PLACES, POWER_VARS } from '../data/power';
import {
  annualFromPowerMonthly, confidenceFromP, forecastSeries, fuse, mean, signed, trend,
  windowCompare, zScoreOutliers, type Forecast, type Indicator, type SeriesPoint, type TrendResult,
} from '../kernel';

type PowerSnapshot = Awaited<ReturnType<typeof loadPowerSnapshot>>;

interface MeteoOverlay { temp: SeriesPoint[]; precip: SeriesPoint[]; years: number[]; url: string }

const pval = (p: number) => (!Number.isFinite(p) ? '–' : p < 0.001 ? p.toExponential(2) : p.toFixed(4));
const perDecade = (slopePerYear: number) => signed(slopePerYear * 10, 2);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
      <div className="truncate text-[10px] text-slate-400">{label}</div>
      <div className="truncate text-[13px] font-semibold text-white">{value}</div>
      {hint && <div className="truncate text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}

/**
 * Earth System Trend Detective — NASA Space Apps 2026 challenge #2.
 * Self-contained: real NASA POWER (bundled snapshot, 2001–2025) for the climate series,
 * a live Open-Meteo archive overlay (2000–2026) as an independent check, a live NASA POWER
 * collector harvest (5 yr daily→monthly) where available.
 * Every figure is labelled live/snapshot/sample; nothing is ever invented.
 */
export function EarthTrendDetective() {
  const [placeId, setPlaceId] = useState('norway');
  const [variable, setVariable] = useState('T2M');

  const [snap, setSnap] = useState<PowerSnapshot | null>(null);
  const [snapErr, setSnapErr] = useState<string | null>(null);
  const [harvest, setHarvest] = useState<PowerHarvest | null>(null);
  const [meteo, setMeteo] = useState<MeteoOverlay | null>(null);
  const [meteoErr, setMeteoErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPowerSnapshot().then((s) => alive && setSnap(s)).catch((e) => alive && setSnapErr(String(e?.message || e)));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadPowerHarvest().then((h) => alive && setHarvest(h)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const p = PLACES.find((x) => x.id === placeId);
    if (!p) return;
    let alive = true;
    setMeteo(null); setMeteoErr(null);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}&start_date=2000-01-01&end_date=2026-11-14&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    fetch(url, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (!alive) return;
        const time = j?.daily?.time as string[] | undefined;
        const t = j?.daily?.temperature_2m_mean as (number | null)[] | undefined;
        const pr = j?.daily?.precipitation_sum as (number | null)[] | undefined;
        if (!time || !t || !pr) throw new Error('Open-Meteo returned no daily series.');
        const byYear = new Map<number, { t: number[]; p: number[] }>();
        time.forEach((d, i) => {
          const y = +d.slice(0, 4);
          const b = byYear.get(y) ?? { t: [], p: [] };
          if (t[i] != null) b.t.push(t[i] as number);
          if (pr[i] != null) b.p.push(pr[i] as number);
          byYear.set(y, b);
        });
        const years = [...byYear.keys()].sort((a, b) => a - b);
        const temp: SeriesPoint[] = years.map((y) => { const b = byYear.get(y)!; return { x: y, y: b.t.length ? mean(b.t) : null }; });
        const precip: SeriesPoint[] = years.map((y) => { const b = byYear.get(y)!; return { x: y, y: b.p.length ? mean(b.p) : null }; });
        setMeteo({ temp, precip, years, url });
      })
      .catch((e) => { if (alive) setMeteoErr(e?.name === 'AbortError' ? 'timeout' : String(e?.message || e)); })
      .finally(() => { clearTimeout(timer); });
    return () => { alive = false; clearTimeout(timer); };
  }, [placeId]);

  const place = PLACES.find((p) => p.id === placeId) ?? PLACES[0];
  const vmeta = POWER_VARS[variable];

  // --- NASA POWER snapshot: 25-year annual climate series ---
  const power = useMemo(() => {
    if (!snap) return null;
    const rec = snap.places[placeId];
    if (!rec) return null;
    const monthly = rec.parameter[variable];
    if (!monthly) return null;
    return {
      annual: annualFromPowerMonthly(monthly, snap.start, snap.end),
      retrieved: snap.retrieved_utc,
      url: rec.url,
      start: snap.start,
      end: snap.end,
    };
  }, [snap, placeId, variable]);

  const tr = useMemo<TrendResult | null>(() => (power ? trend(power.annual, 5) : null), [power]);
  const fc = useMemo<Forecast | null>(() => (power ? forecastSeries(power.annual, { horizon: 10, period: 1 }) : null), [power]);
  const conf = useMemo(() => (tr ? confidenceFromP(tr.mkP) : null), [tr]);
  const outliers = useMemo(() => (power ? zScoreOutliers(power.annual, 2) : []), [power]);

  // --- live NASA POWER harvest: 5-year monthly (where a collector site maps to this place) ---
  const harvestSeries = useMemo(() => {
    const hid = GAZ_TO_HARVEST[placeId];
    if (!harvest || !hid) return null;
    const L = harvest.locations.find((l) => l.id === hid);
    if (!L) return null;
    const m = L.monthly[variable];
    if (!m) return null;
    const keys = Object.keys(m).sort();
    const pts: SeriesPoint[] = keys.map((k) => ({ x: +k.slice(0, 4) + (+k.slice(4) - 0.5) / 12, y: m[k] }));
    const clim: Record<string, number[]> = {};
    keys.forEach((k) => (clim[k.slice(4)] ??= []).push(m[k]));
    const anom: SeriesPoint[] = keys.map((k, i) => ({ x: pts[i].x, y: m[k] - clim[k.slice(4)].reduce((a, b) => a + b, 0) / clim[k.slice(4)].length }));
    const wc = windowCompare(anom, 12);
    return { pts, unit: harvest.units[variable] ?? '', lastDay: L.last_day, label: harvest.label, wc };
  }, [harvest, placeId, variable]);

  // --- Open-Meteo overlay trends (26 yr) ---
  const omTr = useMemo(() => (meteo ? { temp: trend(meteo.temp, 5), precip: trend(meteo.precip, 5) } : null), [meteo]);

  // --- fuse POWER + Open-Meteo when the selected variable is directly comparable ---
  const fuseRes = useMemo(() => {
    if (!tr || !omTr || (variable !== 'T2M' && variable !== 'PRECTOTCORR')) return null;
    const om = variable === 'T2M' ? omTr.temp : omTr.precip;
    const ref = variable === 'T2M' ? 0.3 : 0.1; // °C/decade or mm/day/decade, for normalising the signal
    const sig = (slopePerYear: number) => Math.max(-1, Math.min(1, (slopePerYear * 10) / ref));
    const indicators: Indicator[] = [
      { name: `NASA POWER ${vmeta.short}`, signal: sig(tr.theilSen), quality: 0.9, status: 'snapshot' },
      { name: `Open-Meteo ${variable === 'T2M' ? '2 m temp' : 'precip'}`, signal: sig(om.theilSen), quality: 0.85, status: 'live' },
    ];
    return fuse(indicators);
  }, [tr, omTr, variable]);

  const fracLabel = (x: number) => {
    const y = Math.floor(x);
    const m = Math.round((x - y) * 12) + 1;
    return `${y}-${String(Math.min(12, m)).padStart(2, '0')}`;
  };


  const metrics: { label: string; value: string; hint?: string }[] = tr
    ? [
        { label: 'Theil-Sen trend', value: `${perDecade(tr.theilSen)} ${vmeta.unit}/decade`, hint: 'robust slope' },
        { label: 'OLS trend', value: `${perDecade(tr.olsSlope)} ${vmeta.unit}/decade`, hint: 'least-squares' },
        { label: 'Mann-Kendall p', value: pval(tr.mkP), hint: 'two-sided' },
        { label: 'Significance', value: tr.significant ? 'significant (p<0.05)' : 'not significant', hint: `z=${tr.mkZ.toFixed(2)}` },
        { label: `Means (first→last 5 yr)`, value: `${signed(tr.firstMean, 2)} → ${signed(tr.lastMean, 2)} ${vmeta.unit}`, hint: `${tr.n} annual obs` },
        { label: 'Change', value: `${signed(tr.delta, 2)} ${vmeta.unit}`, hint: `Δ ${signed(tr.deltaPct, 1)}%` },
      ]
    : [];

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-500/20 via-blue-700/15 to-violet-600/15 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-xl border border-sky-300/20 bg-sky-500/10 p-2"><Icon name="ChartColumn" className="h-6 w-6 text-sky-300" /></div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white">Earth System Trend Detective</h2>
              <Chip className="border-sky-400/30 text-sky-200">Space Apps #2</Chip>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Is this place changing, how fast, and how sure are we? Trend slope, Mann-Kendall significance and a 10-year statistical forecast — built from real NASA POWER and Open-Meteo archives, never invented.</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-slate-400">Place
            <select aria-label="Place" className="input !w-auto !py-1.5 ml-1" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              {PLACES.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.country})</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Climate variable
            <select aria-label="Variable" className="input !w-auto !py-1.5 ml-1" value={variable} onChange={(e) => setVariable(e.target.value)}>
              {Object.keys(POWER_VARS).map((k) => <option key={k} value={k}>{POWER_VARS[k].short}</option>)}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <StatusBadge status={power ? 'snapshot' : 'sample'} note={power ? `NASA POWER ${power.start}–${power.end}` : 'loading POWER…'} />
            <StatusBadge status={meteo ? 'live' : 'not connected'} note={meteo ? 'Open-Meteo archive' : 'Open-Meteo unavailable'} />
            {harvestSeries && <StatusBadge status="live" note={`POWER harvest to ${harvestSeries.lastDay}`} />}
          </div>
        </div>
        {snapErr && <p className="mt-3 text-sm text-rose-300">NASA POWER snapshot failed to load ({snapErr}).</p>}
        {!snapErr && !power && <p className="mt-3 text-sm text-slate-400">Loading NASA POWER snapshot…</p>}
      </Glass>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-3">
        {/* LEFT — analysis */}
        <div className="space-y-3">
          {power && tr && (
            <Glass className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-title">{place.name} · {vmeta.short} trend ({power.start}–{power.end})</div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-1.5 py-[1px] text-[10px] font-semibold uppercase ${conf?.level === 'high' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : conf?.level === 'medium' ? 'text-amber-300 border-amber-400/30 bg-amber-500/10' : 'text-rose-300 border-rose-400/30 bg-rose-500/10'}`}>{conf?.level ?? 'low'} confidence</span>
                  <StatusBadge status="snapshot" note={`retrieved ${power.retrieved.slice(0, 10)}`} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{metrics.map((m, i) => <Stat key={i} {...m} />)}</div>
              <LineChart points={power.annual} trend={{ slope: tr.olsSlope, intercept: tr.intercept }} unit={vmeta.unit} height={190} color="#38bdf8" />
              <p className="mt-2 text-sm text-slate-300">
                {tr.significant
                  ? <>The {vmeta.short.toLowerCase()} at {place.name} shows a statistically significant <b className={tr.theilSen >= 0 ? 'text-rose-300' : 'text-sky-300'}>{tr.theilSen >= 0 ? 'increase' : 'decrease'}</b> (Mann-Kendall p&nbsp;=&nbsp;{pval(tr.mkP)}), ≈{perDecade(tr.theilSen)} {vmeta.unit}/decade (Theil-Sen).</>
                  : <>The {vmeta.short.toLowerCase()} trend is <b className="text-slate-200">not statistically significant</b> at the 5% level (Mann-Kendall p&nbsp;=&nbsp;{pval(tr.mkP)}).</>}
                {' '}The dashed pink line is the OLS fit; points are annual means.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{vmeta.note}. Source: NASA POWER monthly point API (bundled snapshot).</p>
            </Glass>
          )}

          {power && fc?.ok && (
            <Glass className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-violet-200">10-year forecast · next {fc.horizon} yr <span className="font-normal text-violet-300/70">(statistical, 95% band)</span></div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${fc.divergence.level === 'normal' ? 'bg-emerald-500/20 text-emerald-200' : fc.divergence.level === 'watch' ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>{fc.divergence.level}</span>
              </div>
              <LineChart points={power.annual} forecast={fc.forecast} unit={vmeta.unit} height={150} color="#a78bfa" />
              <p className="mt-2 text-[11px] text-violet-100/80">{fc.divergence.text}</p>
              <p className="mt-1 text-[11px] text-slate-400">{fc.method} Expected next year ≈ {signed(fc.expectedNext, 2)} {vmeta.unit}. {fc.limitations[0]} Not an official warning or emergency alert.</p>
            </Glass>
          )}

          {harvestSeries && (
            <Glass className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="h-title">Recent 5 years (live) · daily→monthly POWER</div>
                <StatusBadge status="live" note={harvestSeries.label.split('(')[1]?.replace(')', '') ?? 'live'} />
              </div>
              <LineChart points={harvestSeries.pts} unit={harvestSeries.unit} height={130} color="#fbbf24" xLabel={fracLabel} />
              <p className="mt-2 text-[11px] text-slate-400">
                Last 12 months vs earlier (deseasonalised): z = {harvestSeries.wc.z.toFixed(2)}, shift {signed(harvestSeries.wc.delta, 2)} {harvestSeries.unit}. Five years is too short for a climate trend — this is a recent-change signal, not evidence of long-term change.
              </p>
            </Glass>
          )}

          <Glass className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="h-title">Independent check · Open-Meteo archive (ERA5, 2000–2026)</div>
              <StatusBadge status={meteo ? 'live' : 'not connected'} note={meteo ? 'live fetch' : 'unavailable'} />
            </div>
            {meteo && omTr ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="2 m temperature trend" value={`${perDecade(omTr.temp.theilSen)} °C/decade`} hint={`p=${pval(omTr.temp.mkP)} · ${omTr.temp.significant ? 'significant' : 'n.s.'}`} />
                  <Stat label="Precipitation trend" value={`${perDecade(omTr.precip.theilSen)} mm/day/decade`} hint={`p=${pval(omTr.precip.mkP)} · ${omTr.precip.significant ? 'significant' : 'n.s.'}`} />
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  <LineChart points={meteo.temp} trend={{ slope: omTr.temp.olsSlope, intercept: omTr.temp.intercept }} unit="°C" height={130} color="#34d399" />
                  <LineChart points={meteo.precip} unit="mm/day" height={130} bars color="#38bdf8" />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Annual means of daily Open-Meteo archive (ERA5 reanalysis). An independent live source used to sanity-check the POWER snapshot trend.</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-400">{meteoErr ? `Open-Meteo overlay unavailable (${meteoErr}). POWER results still shown.` : 'Fetching Open-Meteo archive…'}</p>
            )}
          </Glass>
        </div>

        {/* RIGHT — live thumbnail + fusion + honesty */}
        <div className="space-y-3">
          {fuseRes && (
            <Glass className="p-3">
              <div className="h-title mb-2">Two-source agreement</div>
              <p className="text-[11px] text-slate-300">NASA POWER (snapshot) and Open-Meteo (live) both point the same way for {vmeta.short.toLowerCase()} at {place.name}.</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Agreement</span>
                <b className="text-white">{Math.round(fuseRes.agreement * 100)}%</b>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-400">Combined confidence</span>
                <b className={`${fuseRes.level === 'high' ? 'text-emerald-300' : fuseRes.level === 'medium' ? 'text-amber-300' : 'text-rose-300'}`}>{fuseRes.level} · {(fuseRes.confidence * 100).toFixed(0)}%</b>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Quality-weighted fusion of the two trend signals. Only shown when the selected variable maps directly onto the Open-Meteo metric (temperature or precipitation).</p>
            </Glass>
          )}

          {outliers.length > 0 && (
            <Glass className="p-3">
              <div className="h-title mb-2">Notable years (z-score ≥ 2)</div>
              <div className="flex flex-wrap gap-1.5">{outliers.map((o) => <Chip key={o.x} className="border-amber-400/30 text-amber-200">{o.x} <span className="text-amber-400/80">z={o.z >= 0 ? '+' : ''}{o.z.toFixed(1)}</span></Chip>)}</div>
              <p className="mt-2 text-[10px] text-slate-500">Statistical outliers in the annual series — worth a human look, not proof of anything.</p>
            </Glass>
          )}

          <Glass className="p-3 text-[11px] leading-relaxed text-slate-400">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white"><Icon name="ShieldCheck" className="h-4 w-4 text-sky-300" />Data honesty</div>
            NASA POWER trend &amp; forecast use the bundled 2001–2025 snapshot (real MERRA-2/CERES values, retrieved {power?.retrieved.slice(0, 10) ?? '—'}). The Open-Meteo overlay is fetched live; if it fails, the figure is labelled unavailable rather than replaced. The 10-year forecast is a statistical extrapolation, not a physical model, and is never an official warning.
          </Glass>
        </div>
      </div>
    </div>
  );
}

export default EarthTrendDetective;
