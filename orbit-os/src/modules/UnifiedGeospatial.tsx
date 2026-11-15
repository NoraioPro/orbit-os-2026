import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../data/live';
import { useStore } from '../state/store';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { OrbitGlobe, type GlobeProject } from '../components/OrbitGlobe';
import { Provenance } from '../components/Provenance';
import { NarrationButton } from '../components/Narration';

/**
 * One Earth, two domains — with the AOIs drawn ON the globe and wired to the
 * panels that read them.
 *
 * Real: NASA POWER monthly series (24 months: GWETROOT / T2M / PRECTOTCORR /
 * WS2M) with a least-squares trend and a same-month year-over-year anomaly
 * computed by scripts/build-domains.mjs, plus GIBS rasters rendered only.
 * Not connected: NDVI values, chlorophyll, ocean currents, sea level, alerts —
 * those panels carry no number.
 */

interface DomainSeries {
  id: string;
  label: string;
  unit: string;
  months: string[];
  ym?: string[];
  values: (number | null)[];
  yoy?: (number | null)[];
  latest: number | null;
  mean: number | null;
  trendPerMonth: number | null;
  note: string;
}
interface DomainImage {
  id: string;
  title: string;
  label: string;
  status: string;
  note?: string;
  gibs?: string;
}
interface DomainData {
  domain: string;
  title: string;
  subtitle: string;
  aoi: { id: string; name: string; lat: number; lon: number };
  generated_at: string;
  provenance: { provider: string; url: string; access: string; honesty: string; note: string };
  imagery: DomainImage[];
  series: DomainSeries[];
  weather: { id: string; label: string; unit: string; value: number | null }[];
  coverage: { start: string | null; end: string | null; window: string; windows?: number[] };
}

type Win = 6 | 12 | 24;
type Mode = 'raw' | 'anomaly';

const BBOX: Record<string, [number, number, number, number]> = {
  agri: [0.5, 11.0, 6.5, 16.5],
  ocean: [-60, 32, -40, 44],
};

function gibsUrl(layer: string, bbox: [number, number, number, number], size = 420, date = '2026-09-01') {
  const [w, s, e, n] = bbox;
  const q = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1', LAYERS: layer, STYLES: '',
    FORMAT: 'image/png', TRANSPARENT: 'false', HEIGHT: String(size), WIDTH: String(size),
    SRS: 'EPSG:4326', BBOX: `${w},${s},${e},${n}`, TIME: date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q.toString()}`;
}

/** slice a series to the window and optionally switch to the year-over-year anomaly */
function shape(s: DomainSeries, win: Win, mode: Mode) {
  const src = mode === 'anomaly' ? s.yoy ?? [] : s.values;
  const values = src.slice(-win);
  const months = s.months.slice(-win);
  return { values, months };
}

function Chart({ s, win, mode, color }: { s: DomainSeries; win: Win; mode: Mode; color: string }) {
  const { values, months } = shape(s, win, mode);
  const W = 360;
  const H = 128;
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return <div className="grid h-24 place-items-center text-[10px] text-slate-500">{mode === 'anomaly' ? 'needs 12+ months for a same-month anomaly' : 'no data'}</div>;
  }
  const min = Math.min(...nums, mode === 'anomaly' ? 0 : Infinity);
  const max = Math.max(...nums, mode === 'anomaly' ? 0 : -Infinity);
  const span = max - min || 1;
  const step = (W - 16) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => (v === null ? null : ([8 + i * step, H - 14 - ((v - min) / span) * (H - 30)] as [number, number]))).filter(Boolean) as [number, number][];
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const zeroY = mode === 'anomaly' ? H - 14 - ((0 - min) / span) * (H - 30) : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${s.label} ${mode} over the last ${win} months`}>
        {[0, 1, 2].map((i) => (
          <line key={i} x1="0" y1={14 + i * ((H - 28) / 2)} x2={W} y2={14 + i * ((H - 28) / 2)} stroke="rgba(148,163,184,.1)" />
        ))}
        {zeroY !== null && <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(226,232,240,.35)" strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill={color} />)}
      </svg>
      <div className="flex justify-between text-[8px] text-slate-500">
        {months.map((m, i) => (i % Math.ceil(months.length / 6) === 0 ? <span key={`${m}${i}`}>{m}</span> : null))}
      </div>
    </div>
  );
}

function ImageryCard({ img, bbox, accent }: { img: DomainImage; bbox: [number, number, number, number]; accent: string }) {
  const [failed, setFailed] = useState(false);
  if (!img.gibs) {
    return (
      <div className="grid h-full min-h-[150px] place-items-center rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-3 text-center">
        <div>
          <Icon name="TriangleAlert" className="mx-auto h-5 w-5 text-amber-300" />
          <p className="mt-1.5 text-[11px] font-semibold text-amber-200">{img.title}</p>
          <p className="mt-0.5 text-[10px] text-amber-300/80">not connected — {img.label}</p>
          {img.note && <p className="mt-1 text-[10px] leading-snug text-slate-400">{img.note}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
      {failed ? (
        <div className="grid h-[180px] place-items-center p-3 text-center text-[10px] text-slate-400">GIBS imagery unavailable for this window.<br />Layer: {img.gibs}</div>
      ) : (
        <img src={gibsUrl(img.gibs, bbox, 440)} alt={`${img.label} — NASA GIBS`} className="h-[180px] w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-2.5 pb-2 pt-8">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-white">{img.title}</span>
          <span className={`shrink-0 text-[10px] ${accent}`}>GIBS</span>
        </div>
        <div className="text-[10px] text-slate-300">{img.label}</div>
        <div className="truncate text-[9px] text-slate-500" title={img.gibs}>layer {img.gibs} · TIME 2026-09-01</div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, unit, status, note, accent }: { label: string; value: string; unit?: string; status?: 'live' | 'sample' | 'not connected'; note?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{label}</span>
        {status && <span className={`shrink-0 text-[9px] font-semibold uppercase ${status === 'live' ? 'text-emerald-300' : status === 'sample' ? 'text-amber-300' : 'text-slate-500'}`}>{status}</span>}
      </div>
      <div className={`mt-1 text-[20px] font-semibold leading-none ${accent}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[10px] leading-snug text-slate-400">{note}</div>}
    </div>
  );
}

function Filters({ win, mode, setWin, setMode, windows, accent }: { win: Win; mode: Mode; setWin: (w: Win) => void; setMode: (m: Mode) => void; windows: number[]; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {([6, 12, 24] as Win[]).filter((w) => windows.includes(w)).map((w) => (
        <button
          key={w}
          onClick={() => setWin(w)}
          className={`rounded border px-1.5 py-[1px] text-[9px] font-semibold uppercase transition ${win === w ? `border-sky-400/50 bg-sky-500/15 ${accent}` : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
        >
          {w}m
        </button>
      ))}
      <span className="mx-1 h-3 w-px bg-white/10" />
      {(['raw', 'anomaly'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded border px-1.5 py-[1px] text-[9px] font-semibold uppercase transition ${mode === m ? `border-sky-400/50 bg-sky-500/15 ${accent}` : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
        >
          {m === 'raw' ? 'raw' : 'yoy'}
        </button>
      ))}
    </div>
  );
}

function DomainPanel({ d, side }: { d: DomainData; side: 'left' | 'right' }) {
  const agri = d.domain === 'agri';
  const accent = agri ? 'text-emerald-300' : 'text-cyan-300';
  const ring = agri ? 'border-emerald-400/25' : 'border-cyan-400/25';
  const glow = agri ? 'from-emerald-500/10' : 'from-cyan-500/10';
  const bbox = BBOX[d.domain] ?? BBOX.agri;
  const [a, b] = d.series;
  const [win, setWin] = useState<Win>(12);
  const [mode, setMode] = useState<Mode>('raw');
  const windows = d.coverage.windows ?? [6];
  const trend = a?.trendPerMonth ?? null;
  const yoyLatest = (a?.yoy ?? []).filter((v) => v !== null).slice(-1)[0] ?? null;

  return (
    <Glass className={`flex min-h-0 flex-col gap-2 border ${ring} bg-gradient-to-b ${glow} to-transparent p-3`}>
      <div className="flex items-start gap-2">
        <div className={`rounded-lg border border-white/10 bg-white/5 p-1.5 ${accent}`}>
          <Icon name={agri ? 'Sprout' : 'Waves'} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-white">{d.title}</h3>
            <StatusBadge status={d.provenance.honesty === 'live' ? 'live' : 'snapshot'} note={d.provenance.honesty} />
          </div>
          <p className="truncate text-[10px] text-slate-400">{d.subtitle} · {d.aoi.name}</p>
        </div>
        {side === 'right' && <Icon name="ChevronRight" className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
      </div>

      <ImageryCard img={d.imagery[0]} bbox={bbox} accent={accent} />

      <div className="grid grid-cols-2 gap-2">
        {agri ? (
          <>
            <MetricTile label="Soil moisture" value={a?.latest != null ? a.latest.toFixed(2) : '—'} unit="of 1.0" status="live" note="POWER GWETROOT · AOI point" accent={accent} />
            <MetricTile label="Precipitation" value={b?.latest != null ? b.latest.toFixed(2) : '—'} unit="mm/day" status="live" note="POWER PRECTOTCORR" accent={accent} />
          </>
        ) : (
          <>
            <MetricTile label="Marine air temp" value={a?.latest != null ? a.latest.toFixed(1) : '—'} unit="°C" status="live" note="T2M over ocean — not SST" accent={accent} />
            <MetricTile label="Chlorophyll" value="—" status="not connected" note="PACE/MODIS ocean colour is a planned connector" accent="text-slate-300" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-300">Time series</span>
          <Filters win={win} mode={mode} setWin={setWin} setMode={setMode} windows={windows} accent={accent} />
        </div>
        {a && <Chart s={a} win={win} mode={mode} color={agri ? '#34d399' : '#22d3ee'} />}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-3 rounded-full ${agri ? 'bg-emerald-400' : 'bg-cyan-400'}`} />{a?.label}</span>
          {trend !== null && <span>trend {trend > 0 ? '+' : ''}{trend.toFixed(3)}/mo</span>}
          {yoyLatest !== null && <span>YoY {yoyLatest > 0 ? '+' : ''}{yoyLatest.toFixed(2)} {a?.unit}</span>}
          <span className="ml-auto">{d.coverage.window}</span>
        </div>
      </div>
    </Glass>
  );
}

/** Connector overlay: AOI pins on the globe wired to the panel that reads them. */
function Connectors({ pins, anchors }: { pins: { id: string; x: number; y: number; color: string; label: string }[]; anchors: { id: string; x: number; y: number; color: string }[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden="true">
      {pins.map((pin) => {
        const anchor = anchors.find((a) => a.id === pin.id);
        if (!anchor) return null;
        const mx = (pin.x + anchor.x) / 2;
        const d = `M${pin.x},${pin.y} C ${mx},${pin.y} ${mx},${anchor.y} ${anchor.x},${anchor.y}`;
        return (
          <g key={pin.id}>
            <path d={d} fill="none" stroke={pin.color} strokeOpacity="0.22" strokeWidth="6" strokeLinecap="round" />
            <path d={d} fill="none" stroke={pin.color} strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" className="connector-flow" />
            <circle cx={pin.x} cy={pin.y} r="4" fill={pin.color} stroke="#02040d" strokeWidth="1.2" />
            <circle cx={pin.x} cy={pin.y} r="9" fill="none" stroke={pin.color} strokeOpacity="0.65" className="connector-pulse" />
            <circle cx={anchor.x} cy={anchor.y} r="3" fill={pin.color} stroke="#02040d" strokeWidth="1" />
            <g>
              <rect x={pin.x + 8} y={pin.y - 19} width={Math.max(56, pin.label.length * 4.9)} height="14" rx="4" fill="#02040d" fillOpacity="0.82" stroke={pin.color} strokeOpacity="0.45" />
              <text x={pin.x + 13} y={pin.y - 9} fontSize="9" fill="#f1f5f9">{pin.label}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Agri × Ocean unified view — one Earth, two domains, one Earthdata path. */
export function UnifiedGeospatial() {
  const { db } = useStore();
  const [agri, setAgri] = useState<DomainData | null>(null);
  const [ocean, setOcean] = useState<DomainData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<GlobeProject | null>(null);
  const [pins, setPins] = useState<{ id: string; x: number; y: number; color: string; label: string }[]>([]);
  const [anchors, setAnchors] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const onProject = useCallback((p: GlobeProject | null) => setProject(() => p), []);

  useEffect(() => {
    let live = true;
    Promise.all([fetchJson('/data/domains/agri.json', 9000), fetchJson('/data/domains/ocean.json', 9000)])
      .then(([a, o]: [DomainData, DomainData]) => {
        if (!live) return;
        setAgri(a);
        setOcean(o);
      })
      .catch((e: Error) => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // keep the pins glued to the rotating globe, and the anchors on the panel headers
  useEffect(() => {
    if (!project || !agri || !ocean) return;
    let raf = 0;
    const tick = () => {
      const grid = gridRef.current?.getBoundingClientRect();
      const centre = centreRef.current?.getBoundingClientRect();
      if (!grid || !centre) {
        raf = window.setTimeout(tick, 500);
        return;
      }
      const next: { id: string; x: number; y: number; color: string; label: string }[] = [];
      const targets: [string, number, number, string, string][] = [
        ['agri', agri.aoi.lat, agri.aoi.lon, '#34d399', `${agri.aoi.name} · ${agri.series[0]?.latest?.toFixed(2) ?? '—'}`],
        ['ocean', ocean.aoi.lat, ocean.aoi.lon, '#22d3ee', `${ocean.aoi.name} · ${ocean.series[0]?.latest?.toFixed(1) ?? '—'} °C`],
      ];
      for (const [id, lat, lon, color, label] of targets) {
        const p = project(lat, lon);
        if (!p) continue;
        const x = centre.left - grid.left + p.x;
        const y = centre.top - grid.top + p.y;
        if (x < 0 || y < 0 || x > grid.width || y > grid.height) continue;
        next.push({ id, x, y, color, label });
      }
      setPins(next);

      const la = leftRef.current?.getBoundingClientRect();
      const ra = rightRef.current?.getBoundingClientRect();
      const a: { id: string; x: number; y: number; color: string }[] = [];
      if (la) a.push({ id: 'agri', x: la.right - grid.left - 6, y: la.top - grid.top + 40, color: '#34d399' });
      if (ra) a.push({ id: 'ocean', x: ra.left - grid.left + 6, y: ra.top - grid.top + 40, color: '#22d3ee' });
      setAnchors(a);
      raf = window.setTimeout(tick, 420);
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [project, agri, ocean]);

  const weatherRows = useMemo(() => {
    if (!agri || !ocean) return [];
    return [
      { aoi: agri.aoi.name, kind: 'Land AOI · POWER AG', accent: 'text-emerald-300', values: agri.weather },
      { aoi: ocean.aoi.name, kind: 'Ocean AOI · POWER RE', accent: 'text-cyan-300', values: ocean.weather },
    ];
  }, [agri, ocean]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold leading-tight text-white">
            Agri Intelligence <span className="text-slate-500">&amp;</span> Ocean Intelligence
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-300">Unified geospatial analytics with NASA Earthdata · AOIs are pinned on the globe and wired to the panels that read them</p>
        </div>
        <div className="flex items-center gap-2">
          <NarrationButton src="/assets/audio/earth-intelligence.mp3" label="Narration" />
          <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-tight text-white">NASA</span>
              <span className="text-[11px] text-sky-200">Earthdata</span>
            </div>
            <div className="text-[9px] leading-tight text-slate-400">Multi-source satellite observations for land, ocean and atmosphere</div>
          </div>
        </div>
      </div>

      {loading && <Glass className="p-6 text-center text-[12px] text-slate-400">Loading domain layer…</Glass>}
      {err && (
        <Glass className="border-amber-400/30 p-4 text-[12px] text-amber-200">
          Domain layer failed to load ({err}). Run <code className="rounded bg-white/10 px-1">npm run data:domains</code> to rebuild it — nothing is shown rather than a guess.
        </Glass>
      )}

      {agri && ocean && (
        <>
          <div ref={gridRef} className="relative grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1.18fr)_minmax(0,1fr)]">
            <div className="min-w-0" ref={leftRef}>
              <DomainPanel d={agri} side="left" />
            </div>

            <div ref={centreRef} className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-b from-slate-900/40 to-slate-950/60">
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">One Earth · two domains</span>
                <Chip><Icon name="Earth" className="h-3 w-3" /> {pins.length}/2 AOIs pinned</Chip>
              </div>
              <div className="min-h-0 flex-1">
                <OrbitGlobe db={db} height={360} autoRotate layerSelector={false} showFirms={false} initial={{ lat: 20, lng: 0, altitude: 2.1 }} onProject={onProject} />
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3 text-[10px]">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-emerald-300">{agri.aoi.name}</span>
                    <span className="text-[8px] uppercase text-emerald-300/70">spot</span>
                  </div>
                  <div className="text-slate-400">agri · {agri.aoi.lat}°N {agri.aoi.lon}°E</div>
                  <div className="mt-0.5 text-emerald-200">soil {agri.series[0]?.latest?.toFixed(2) ?? '—'} · precip {agri.series[1]?.latest?.toFixed(2) ?? '—'} mm/day</div>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-cyan-300">{ocean.aoi.name}</span>
                    <span className="text-[8px] uppercase text-cyan-300/70">spot</span>
                  </div>
                  <div className="text-slate-400">ocean · {ocean.aoi.lat}°N {Math.abs(ocean.aoi.lon)}°W</div>
                  <div className="mt-0.5 text-cyan-200">marine T2M {ocean.series[0]?.latest?.toFixed(1) ?? '—'} °C · wind {ocean.series[1]?.latest?.toFixed(1) ?? '—'} m/s</div>
                </div>
              </div>
            </div>

            <div className="min-w-0" ref={rightRef}>
              <DomainPanel d={ocean} side="right" />
            </div>

            <Connectors pins={pins} anchors={anchors} />
          </div>

          <Glass className="p-3">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-white">Weather context</h3>
                <p className="text-[10px] text-slate-400">Latest complete month per AOI · NASA POWER monthly point API</p>
              </div>
              <span className="text-[10px] text-slate-400">a parameter POWER does not return is shown as “not returned”, never as zero</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {weatherRows.map((row) => (
                <div key={row.aoi} className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${row.accent}`}>{row.aoi}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">{row.kind}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {row.values.map((w) => (
                      <div key={w.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-1">
                        <div className="truncate text-[10px] uppercase tracking-[0.06em] text-slate-400">{w.label}</div>
                        <div className="text-[13px] font-semibold text-white">
                          {w.value === null ? (
                            <span className="text-slate-500" title="POWER returned a fill value for this parameter/AOI">not returned</span>
                          ) : (
                            <>
                              {w.value.toFixed(1)}
                              <span className="ml-0.5 text-[10px] font-normal text-slate-400">{w.unit}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Glass>

          <Provenance
            honesty="live"
            coverage={{ start: agri.coverage.start ?? '', end: agri.coverage.end ?? '', label: `${agri.coverage.window} (POWER monthly · up to 24 months per AOI)` }}
            citation="ORBIT OS · unified domain layer built by scripts/build-domains.mjs from keyless NASA POWER + NASA GIBS"
            sources={[
              { name: 'NASA POWER', url: 'https://power.larc.nasa.gov/', note: 'GWETROOT · T2M · PRECTOTCORR · WS2M, monthly point API' },
              { name: 'NASA GIBS', url: 'https://gibs.earthdata.nasa.gov/', note: 'MODIS Terra NDVI 8-day · GHRSST MUR L4 SST (imagery only)' },
              { name: 'NASA Earthdata', url: 'https://www.earthdata.nasa.gov/', note: 'imagery and parameter access path' },
            ]}
          />
          <p className="text-[11px] leading-relaxed text-slate-400">
            Honesty: MODIS/VIIRS/GHRSST tiles are rendered by NASA GIBS and never read back as pixel values. Soil moisture is POWER GWETROOT
            (root-zone wetness, 0–1), not a SMAP retrieval. Marine temperature is air temperature over the ocean, not SST. The trend is a
            least-squares slope over the real monthly points, and “yoy” is the same-month difference against the previous year — both computed
            from POWER, never interpolated. Chlorophyll has no connector in this build, so the panel shows “not connected” instead of a number.
          </p>
        </>
      )}
    </div>
  );
}
