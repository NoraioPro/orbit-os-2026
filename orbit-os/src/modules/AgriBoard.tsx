import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../data/live';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { HiResImagery } from './HiResImagery';

/**
 * Agri Intelligence board — Østfold, Norway.
 *
 * REAL: NASA POWER monthly series (soil moisture GWETROOT, air temperature, precipitation)
 *       and the MODIS Terra NDVI 8-day raster rendered by NASA GIBS (imagery only).
 * NOT CONNECTED: NDVI values, SAR backscatter, field-area statistics. Those panels show a
 *       reason instead of a number — a made-up crop metric is worse than a blank one here.
 */

interface Series {
  id: string;
  label: string;
  unit: string;
  months: string[];
  values: (number | null)[];
  latest: number | null;
  mean: number | null;
  note: string;
}
interface DomainFile {
  domain: string;
  title: string;
  subtitle: string;
  aoi: { id: string; name: string; lat: number; lon: number };
  generated_at: string;
  provenance: { provider: string; url: string; access: string; honesty: string; note: string };
  imagery: { id: string; title: string; label: string; status: string; gibs?: string; note?: string }[];
  series: Series[];
  weather: { id: string; label: string; unit: string; value: number | null }[];
  coverage: { start: string | null; end: string | null; window: string };
}

const BBOX_OSTFOLD: [number, number, number, number] = [10.2, 58.9, 11.9, 59.85];

function gibsUrl(layer: string, bbox: [number, number, number, number], size = 620, date = '2026-09-01') {
  const [w, s, e, n] = bbox;
  const q = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1', LAYERS: layer, STYLES: '',
    FORMAT: 'image/png', TRANSPARENT: 'false', HEIGHT: String(size), WIDTH: String(size),
    SRS: 'EPSG:4326', BBOX: `${w},${s},${e},${n}`, TIME: date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q.toString()}`;
}

function trend(s: Series | undefined): 'Improving' | 'Declining' | 'Stable' {
  if (!s) return 'Stable';
  const vals = s.values.filter((v): v is number => v !== null);
  if (vals.length < 3) return 'Stable';
  const mid = Math.floor(vals.length / 2);
  const firstHalf = vals.slice(0, mid);
  const secondHalf = vals.slice(mid);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const change = ((avg(secondHalf) - avg(firstHalf)) / Math.max(1e-6, Math.abs(avg(firstHalf)))) * 100;
  if (change > 2) return 'Improving';
  if (change < -2) return 'Declining';
  return 'Stable';
}

function delta(s: Series | undefined): number | null {
  if (!s) return null;
  const vals = s.values.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const prev = vals[vals.length - 2];
  const last = vals[vals.length - 1];
  if (!prev) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
}

function Indicator({ label, value, unit, change, note, tone = 'sky', badge }: { label: string; value: string; unit?: string; change?: number | null; note: string; tone?: 'sky' | 'emerald' | 'amber' | 'slate'; badge?: string }) {
  const valueTone = tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'slate' ? 'text-slate-300' : 'text-sky-300';
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{label}</span>
        {badge && <span className="shrink-0 rounded border border-amber-400/30 bg-amber-500/10 px-1 py-[1px] text-[9px] font-semibold uppercase text-amber-300">{badge}</span>}
      </div>
      <div className={`mt-1 flex items-baseline gap-1.5 text-[20px] font-semibold leading-none ${valueTone}`}>
        {value}
        {unit && <span className="text-[10px] font-normal text-slate-400">{unit}</span>}
        {change !== null && change !== undefined && (
          <span className={`ml-auto text-[11px] font-semibold ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] leading-snug text-slate-400">{note}</div>
    </div>
  );
}

function NotConnected({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-400/25 bg-amber-500/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-amber-200">{label}</span>
        <span className="shrink-0 text-[9px] font-semibold uppercase text-amber-300/90">not connected</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none text-slate-500">—</div>
      <div className="mt-1 text-[10px] leading-snug text-amber-200/70">{reason}</div>
    </div>
  );
}

function SeriesChart({ s }: { s: Series }) {
  const W = 420;
  const H = 120;
  const vals = s.values.filter((v): v is number => v !== null);
  if (!vals.length) return <div className="grid h-24 place-items-center text-[11px] text-slate-500">No data</div>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = s.values.length > 1 ? (W - 16) / (s.values.length - 1) : 0;
  const pts = s.values.map((v, i) => (v === null ? null : [8 + i * step, H - 12 - ((v - min) / span) * (H - 30)] as [number, number])).filter(Boolean) as [number, number][];
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[10px] text-slate-300">
        <span>{s.label} <span className="text-slate-500">({s.unit})</span></span>
        <span className="text-slate-500">y {max.toFixed(2)} → {min.toFixed(2)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${s.label} monthly series, ${s.unit}`}>
        {[0, 1, 2].map((i) => (
          <line key={i} x1="0" y1={12 + i * ((H - 24) / 2)} x2={W} y2={12 + i * ((H - 24) / 2)} stroke="rgba(148,163,184,.1)" />
        ))}
        <path d={path} fill="none" stroke="#34d399" strokeWidth="2" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#34d399" />)}
      </svg>
      <div className="flex justify-between text-[9px] text-slate-500">
        {s.months.map((m, i) => <span key={`${m}${i}`}>{m}</span>)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>min {min.toFixed(2)} · max {max.toFixed(2)} {s.unit}</span>
        <span>latest {s.latest === null ? '—' : s.latest.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function AgriBoard() {
  const [d, setD] = useState<DomainFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchJson('/data/domains/agri-ostfold.json', 9000)
      .then((f: DomainFile) => live && setD(f))
      .catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, []);

  const soil = d?.series.find((s) => s.id === 'gwetroot');
  const temp = d?.series.find((s) => s.id === 't2m');
  const prec = d?.series.find((s) => s.id === 'prectotcorr');
  const ndviLayer = d?.imagery.find((i) => i.gibs)?.gibs;

  const summary = useMemo(() => {
    if (!d || !soil || !prec) return null;
    const sm = delta(soil);
    const pr = delta(prec);
    const parts: string[] = [];
    if (sm !== null) parts.push(Math.abs(sm) < 0.05
      ? `root-zone soil moisture was unchanged month over month (${soil.latest?.toFixed(2)} of 1.0)`
      : `root-zone soil moisture ${sm > 0 ? 'rose' : 'fell'} ${Math.abs(sm).toFixed(1)}% month over month (${soil.latest?.toFixed(2)} of 1.0)`);
    if (pr !== null) parts.push(`precipitation ${pr >= 0 ? 'increased' : 'decreased'} ${Math.abs(pr).toFixed(1)}%`);
    if (temp?.latest !== null && temp?.latest !== undefined) parts.push(`air temperature is ${temp.latest.toFixed(1)} °C`);
    return parts.join(', ');
  }, [d, soil, prec, temp]);

  return (
    <Glass className="flex flex-col gap-3 border-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.07] to-transparent p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-emerald-300"><Icon name="Sprout" className="h-4 w-4" /></div>
            <h3 className="text-[15px] font-semibold text-white">Agri Intelligence</h3>
            <StatusBadge status="live" note="power + gibs" />
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {d ? `${d.aoi.name} · ${d.aoi.lat.toFixed(2)}°N ${d.aoi.lon.toFixed(2)}°E` : 'Loading AOI…'} · crop-region monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip>{d?.coverage.window ?? '—'}</Chip>
          <Chip><Icon name="Database" className="h-3 w-3" />POWER · GIBS</Chip>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          Agri domain file failed to load ({err}). Run <code className="rounded bg-white/10 px-1">npm run data:domains</code> — no value is invented in its place.
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]">
        {/* 30 m imagery: HLS + OPERA, replacing the 250 m MODIS NDVI view */}
        <HiResImagery aoiId="agri-ostfold" />

        {/* indicators */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Indicator
              label="Soil moisture"
              value={soil?.latest === null || soil === undefined ? '—' : soil.latest.toFixed(2)}
              unit="of 1.0"
              change={delta(soil)}
              tone="emerald"
              note="POWER GWETROOT · root zone, AOI point"
            />
            <Indicator
              label="Air temperature"
              value={temp?.latest === null || temp === undefined ? '—' : temp.latest.toFixed(1)}
              unit="°C"
              change={null}
              tone="sky"
              note="POWER T2M monthly mean"
            />
            <Indicator
              label="Precipitation"
              value={prec?.latest === null || prec === undefined ? '—' : prec.latest.toFixed(2)}
              unit="mm/day"
              change={delta(prec)}
              tone="sky"
              note="POWER PRECTOTCORR monthly mean"
            />
            <Indicator
              label="Vegetation trend"
              value={soil ? trend(soil) : '—'}
              change={null}
              tone="emerald"
              note="first-half vs second-half mean of the POWER soil-moisture series — not an NDVI reading"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NotConnected label="NDVI value" reason="MODIS/VIIRS subsets need an Earthdata login — GIBS gives imagery only" />
            <NotConnected label="SAR backscatter" reason="NISAR/Sentinel-1 products are not downloaded in this build" />
            <NotConnected label="Field area · healthy %" reason="needs field boundaries + NDVI values (not connected)" />
            <NotConnected label="Change detection %" reason="needs two NDVI retrievals; the imagery is not a measurement" />
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Time series · {d?.coverage.window ?? '—'}</span>
              <span className="text-[9px] text-slate-500">POWER monthly</span>
            </div>
            {soil && <SeriesChart s={soil} />}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-2.5">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" className="h-3.5 w-3.5 text-emerald-300" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Summary</span>
          <span className="text-[9px] text-slate-400">rule-based, computed from the POWER values above — no language model is called</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-200">
          {summary ? `${summary.charAt(0).toUpperCase() + summary.slice(1)}. ` : 'Waiting for the domain file… '}
          Crop-health and backscatter statements are deliberately absent: those products are not connected in this build and the board does not guess them.
        </p>
      </div>

      {d && (
        <Provenance
          honesty="live"
          coverage={{ start: d.coverage.start ?? '', end: d.coverage.end ?? '', label: d.coverage.window }}
          citation="ORBIT OS · agri domain file written by scripts/build-domains.mjs"
          sources={[
            { name: 'NASA POWER', url: 'https://power.larc.nasa.gov/', note: 'GWETROOT · T2M · PRECTOTCORR, monthly point API' },
            { name: 'NASA GIBS', url: 'https://gibs.earthdata.nasa.gov/', note: 'HLS S30/L30 + OPERA 30 m — imagery only' },
          ]}
        />
      )}
    </Glass>
  );
}
