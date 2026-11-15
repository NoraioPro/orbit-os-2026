import { useEffect, useMemo, useState } from 'react';
import { Glass, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { WorkflowStrip } from '../components/WorkflowStrip';

/**
 * SAR Earth Observatory — InSAR fault lab, East Anatolian Fault.
 *
 * REAL: the Sentinel-1 acquisition pair (same relative orbit + frame, latest
 * scene before the 6 Feb 2023 M7.8 and earliest after), its footprints, orbit
 * numbers and product metadata, all fetched from the NASA ASF Search API by
 * scripts/build-domains.mjs into /data/domains/sar-fault.json.
 * SAMPLE: the amplitude and fringe imagery. No interferogram is processed here,
 * so no displacement value is claimed — the panels say so.
 */

const AOI = { lat: 37.6, lon: 36.9, name: 'East Anatolian Fault · Türkiye / Syria' };

interface Granule {
  granule: string | null;
  platform: string | null;
  startTime: string | null;
  stopTime: string | null;
  flightDirection: string | null;
  relativeOrbit: number | null;
  frame: number | null;
  beamMode: string | null;
  polarization: string | null;
  processingLevel: string | null;
  centerLat: number | null;
  centerLon: number | null;
  sizeMB: number | null;
  footprint: string | null;
  thumbnail: string | null;
  downloadUrl: string | null;
  insarGrouping: string | null;
}
interface FaultFile {
  generated_at: string;
  aoi: { lat: number; lon: number; name: string };
  event: { id: string; label: string; timeUtc: string };
  provenance: { provider: string; url: string; access: string; honesty: string; note: string };
  pair: { before: Granule | null; after: Granule | null };
  nisarCurrent: Granule | null;
  queries: { before: string; after: string; nisar: string };
}

const fmt = (s?: string | null) => (s ? s.replace('T', ' ').replace('Z', ' UTC').slice(0, 19) : '—');
const shortId = (g?: string | null) => (g ? g.replace(/^S1A_|^S1B_|^S1C_/, 'S1A ').replace(/__/g, ' ').slice(0, 34) : '—');
const daysBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) : null;

/** parse a WKT POLYGON into [lon,lat] pairs */
function parseFootprint(wkt?: string | null): [number, number][] {
  if (!wkt) return [];
  const m = wkt.match(/\(\(([^)]+)\)\)/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n))) as [number, number][];
}

function FaultMap({ pair }: { pair: FaultFile['pair'] }) {
  const W = 800;
  const H = 440;
  const before = useMemo(() => parseFootprint(pair.before?.footprint), [pair.before]);
  const after = useMemo(() => parseFootprint(pair.after?.footprint), [pair.after]);

  const project = useMemo(() => {
    const all = [...before, ...after];
    if (all.length < 3) return null;
    const lons = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    const pad = 0.25;
    const minLon = Math.min(...lons) - pad;
    const maxLon = Math.max(...lons) + pad;
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;
    // keep aspect ratio honest: scale by the larger span
    const spanLon = maxLon - minLon;
    const spanLat = maxLat - minLat;
    const scale = Math.min((W - 40) / spanLon, (H - 60) / spanLat);
    const cx = (minLon + maxLon) / 2;
    const cy = (minLat + maxLat) / 2;
    return (lon: number, lat: number): [number, number] => [W / 2 + (lon - cx) * scale, H / 2 - (lat - cy) * scale];
  }, [before, after]);

  const poly = (pts: [number, number][]) => (project ? pts.map((p) => project(p[0], p[1])).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ') : '');
  const aoiPt = project ? project(AOI.lon, AOI.lat) : [W / 2, H / 2];
  const kmPerDeg = 111.32 * Math.cos((AOI.lat * Math.PI) / 180);
  const scaleKm = 100;
  const scalePx = project ? Math.abs(project(AOI.lon + scaleKm / kmPerDeg, AOI.lat)[0] - aoiPt[0]) : 120;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Real Sentinel-1 footprints over the East Anatolian Fault">
        <defs>
          <pattern id="sfl-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 40" fill="none" stroke="#16202b" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#0a1018" />
        <rect width={W} height={H} fill="url(#sfl-grid)" />

        {/* fault trace (schematic, not a mapped geometry) */}
        <path d="M250 70 L360 160 L440 240 L520 330 L600 390" stroke="#93c5fd" strokeWidth="2" fill="none" strokeDasharray="2 5" opacity="0.75" />

        {/* real footprints from ASF WKT */}
        {before.length > 2 && <polygon points={poly(before)} fill="#eab308" fillOpacity="0.10" stroke="#eab308" strokeWidth="2" />}
        {after.length > 2 && <polygon points={poly(after)} fill="#22d3ee" fillOpacity="0.04" stroke="#22d3ee" strokeWidth="2.2" strokeDasharray="10 6" />}

        <circle cx={aoiPt[0]} cy={aoiPt[1]} r="5" fill="#ef4444" />
        <circle cx={aoiPt[0]} cy={aoiPt[1]} r="12" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />

        {/* labels carry the real dates */}
        <text x={16} y={22} fill="#eab308" fontSize="10">
          Sentinel-1A ascending · before · {fmt(pair.before?.startTime)}
        </text>
        <text x={16} y={36} fill="#22d3ee" fontSize="10">
          Sentinel-1A ascending · after · {fmt(pair.after?.startTime)}
        </text>
        <text x={aoiPt[0] + 12} y={aoiPt[1] - 8} fill="#e2e8f0" fontSize="10">East Anatolian Fault · {AOI.lat}°N {AOI.lon}°E</text>
        <text x={20} y={H - 16} fill="#94a3b8" fontSize="10">footprints: real ASF WKT · the pair shares one track, so they overlap by design</text>
        <g transform={`translate(${W - 150},${H - 34})`}>
          <line x1="0" y1="0" x2={scalePx} y2="0" stroke="#94a3b8" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#94a3b8" strokeWidth="2" />
          <line x1={scalePx} y1="-4" x2={scalePx} y2="4" stroke="#94a3b8" strokeWidth="2" />
          <text x={scalePx / 2} y="-6" fill="#94a3b8" fontSize="9" textAnchor="middle">{scaleKm} km</text>
        </g>
      </svg>
    </div>
  );
}

function SceneRow({ g, tone, kind }: { g: Granule | null; tone: 'before' | 'after' | 'now'; kind: string }) {
  const color = tone === 'before' ? 'text-amber-300' : tone === 'after' ? 'text-cyan-300' : 'text-violet-300';
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] uppercase tracking-wide ${color}`}>{kind}</span>
        {g?.flightDirection && <span className="text-[9px] uppercase text-slate-400">{g.flightDirection}</span>}
      </div>
      {g ? (
        <>
          <div className="mt-0.5 font-mono-data text-[11px] leading-tight text-slate-200">{fmt(g.startTime)}</div>
          <div className="truncate text-[10px] text-slate-400" title={g.granule ?? ''}>{shortId(g.granule)}</div>
          <div className="mt-0.5 text-[9px] text-slate-500">
            {g.platform ?? '—'} · {g.processingLevel ?? '—'} · {g.beamMode ?? '—'} · rel.orbit {g.relativeOrbit ?? '—'} · frame {g.frame ?? '—'} · {g.polarization ?? '—'}
            {g.sizeMB ? ` · ${g.sizeMB} MB` : ''}
          </div>
          <div className="mt-1 flex gap-2 text-[9px]">
            {g.downloadUrl && (
              <a className="text-sky-400 hover:underline" href={g.downloadUrl} target="_blank" rel="noreferrer">
                ASF granule ↗
              </a>
            )}
            {g.insarGrouping && <span className="text-slate-500">InSAR group {g.insarGrouping}</span>}
          </div>
        </>
      ) : (
        <div className="mt-1 text-[10px] text-amber-300/80">no record returned by ASF for this window</div>
      )}
    </div>
  );
}

function Amplitude({ label, tone, src }: { label: string; tone: 'before' | 'after'; src?: string | null }) {
  const base = tone === 'before' ? '#eab308' : '#22d3ee';
  const [failed, setFailed] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      {src && !failed ? (
        <img src={src} alt={`${label} thumbnail`} className="mt-1 w-full rounded object-cover" onError={() => setFailed(true)} />
      ) : (
        <svg viewBox="0 0 160 110" className="mt-1 w-full rounded" role="img" aria-label="sample amplitude grid">
          <rect width="160" height="110" fill="#0b1220" />
          {Array.from({ length: 40 }).map((_, i) => (
            <rect key={i} x={(i % 8) * 20} y={Math.floor(i / 8) * 22} width="18" height="20" fill={base} opacity={0.15 + ((i * 37) % 60) / 120} />
          ))}
        </svg>
      )}
      <div className="mt-1 text-[9px] text-amber-300/70">{src && !failed ? 'thumbnail only · not amplitude values' : 'SAMPLE · synthetic amplitude'}</div>
    </div>
  );
}

function Fringes() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">InSAR fringes</div>
      <svg viewBox="0 0 160 130" className="mt-1 w-full rounded" role="img" aria-label="sample fringe pattern">
        <rect width="160" height="130" fill="#0b1220" />
        {['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'].map((hue, i) => (
          <path key={i} d={`M 20 65 ${Array.from({ length: 120 }).map((_, x) => `${x % 2 ? 'Q' : ''}${20 + x} ${65 + Math.sin(x / 12 + i) * (18 - i * 2)}`).join(' ')}`} stroke={hue} strokeWidth="1.4" fill="none" opacity="0.85" />
        ))}
      </svg>
      <div className="mt-1 text-[9px] text-amber-300/70">SAMPLE · no interferogram is processed in this build</div>
    </div>
  );
}

export function SarFaultLab() {
  const [file, setFile] = useState<FaultFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/domains/sar-fault.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FaultFile) => alive && setFile(d))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const before = file?.pair.before ?? null;
  const after = file?.pair.after ?? null;
  const nisar = file?.nisarCurrent ?? null;
  const baseline = daysBetween(before?.startTime, after?.startTime);
  const sameTrack = before && after ? before.relativeOrbit === after.relativeOrbit && before.frame === after.frame : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-teal-500/15 via-slate-900/20 to-slate-900/10 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-white">SAR Earth Observatory — InSAR fault lab</div>
          <p className="mt-0.5 text-xs text-slate-300">
            Real Sentinel-1 acquisition pair over the {AOI.name}
            {before && after ? ` · ${fmt(before.startTime).slice(0, 10)} → ${fmt(after.startTime).slice(0, 10)} (${baseline} d baseline)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={file ? 'live' : 'snapshot'} note={file ? 'asf metadata' : 'no catalog'} />
          <StatusBadge status="sample" note="amplitude / fringes" />
        </div>
      </div>

      {err && (
        <Glass className="border-amber-400/30 p-3 text-[11px] text-amber-200">
          Fault pair file unavailable ({err}). Run <code className="rounded bg-white/10 px-1">npm run data:domains</code> — the panel will not invent an acquisition.
        </Glass>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <Glass className="p-3">
          <div className="h-title">Study overview</div>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            {[
              ['Area of interest', `${AOI.lat}°N, ${AOI.lon}°E`],
              ['Region', AOI.name],
              ['Dataset', 'NASA Earthdata · Sentinel-1 (C-band)'],
              ['Method', 'InSAR change detection'],
              ['Product', 'Line-of-sight ground deformation'],
              ['Event', `${file?.event.label ?? 'M7.8 Kahramanmaras sequence'} · ${fmt(file?.event.timeUtc).slice(0, 10)}`],
              ['Acquisition pair', before && after ? `${before.platform} asc · ${fmt(before.startTime).slice(0, 10)} ⟶ ${fmt(after.startTime).slice(0, 10)}` : '—'],
              ['Baseline / track', before && after ? `${baseline} d · rel.orbit ${before.relativeOrbit ?? '—'} · frame ${before.frame ?? '—'}${sameTrack ? ' · same track ✓' : ' · tracks differ'}` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-white/5 pb-1 last:border-0">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
          {before && after && (
            <div className={`mt-2 rounded-lg border p-2 text-[10px] leading-snug ${sameTrack ? 'border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-200' : 'border-amber-400/25 bg-amber-500/[0.06] text-amber-200'}`}>
              {sameTrack
                ? 'Same relative orbit and frame, so these two scenes are interferometrically compatible. No interferogram has been processed in this build.'
                : 'These scenes are not on the same track — ASF returned no same-track pair for this window, so no interferogram could be formed.'}
            </div>
          )}
        </Glass>

        <Glass className="overflow-hidden p-0">
          <FaultMap pair={file?.pair ?? { before: null, after: null }} />
        </Glass>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Glass className="p-3">
          <div className="h-title">Acquisition pair</div>
          <div className="mt-2 space-y-2">
            <SceneRow g={before} tone="before" kind="Before · Sentinel-1" />
            <SceneRow g={after} tone="after" kind="After · Sentinel-1" />
            <SceneRow g={nisar} tone="now" kind="Current era · NISAR (not paired)" />
          </div>
          <div className="mt-2 text-[9px] leading-snug text-slate-500">
            NISAR first acquired in 2025, so it cannot be part of a 2023 interferometric pair; it is shown as the current-era successor only.
          </div>
        </Glass>

        <Amplitude label="Before · scene thumbnail" tone="before" src={before?.thumbnail} />
        <Amplitude label="After · scene thumbnail" tone="after" src={after?.thumbnail} />
        <Fringes />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Glass className="p-3">
          <div className="h-title">Displacement precision</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-bold text-white">not computed</span>
            <span className="mb-1 text-[10px] text-amber-300/80">SAMPLE UI</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            The pair is real, but the displacement product is not: InSAR processing needs an Earthdata-authenticated granule download and a
            processor (ISCE/HyP3). Calling a resolution on this screen would be invented, so it stays “not computed”.
          </p>
        </Glass>
        <Glass className="p-3">
          <div className="h-title">Source traceability</div>
          <ul className="mt-2 space-y-1 text-[11px]">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Sentinel-1 SLC pair · ASF · <a className="text-sky-400 hover:underline" href={file?.queries.before ?? 'https://asf.alaska.edu/'} target="_blank" rel="noreferrer">query ↗</a></li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />NISAR GSLC (current era) · ASF · <a className="text-sky-400 hover:underline" href={file?.queries.nisar ?? 'https://nisar.jpl.nasa.gov/'} target="_blank" rel="noreferrer">query ↗</a></li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Amplitude / fringes · SAMPLE template</li>
            {file && <li className="flex items-center gap-2 text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />harvested {new Date(file.generated_at).toLocaleString('en-GB', { hour12: false })}</li>}
          </ul>
        </Glass>
      </div>

      <WorkflowStrip active={2} />

      <Provenance
        sources={[
          { name: 'NASA ASF Search', url: 'https://asf.alaska.edu/', note: 'keyless scene metadata + footprints' },
          { name: 'Copernicus Sentinel-1', url: 'https://dataspace.copernicus.eu/', note: 'C-band SLC products' },
          { name: 'NISAR', url: 'https://nisar.jpl.nasa.gov/', note: 'Earthdata login for products' },
        ]}
        coverage={{
          start: (before?.startTime ?? '').slice(0, 10),
          end: (after?.startTime ?? '').slice(0, 10),
          label: before && after ? `real pair baseline ${baseline} d` : 'no pair loaded',
        }}
        honesty="live"
        citation="NASA ASF Search API · ESA Copernicus Sentinel-1 · ORBIT OS domain file scripts/build-domains.mjs"
      />
    </div>
  );
}
