import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { gpPosition, orbitClass, ORBIT_CLASSES } from '../kernel/orbit';
import { loadEvents, TYPE_META, type EventsDB } from '../data/events';
import { loadFirms, loadSpace, type FirmsGrid, type SpaceHarvest } from '../data/harvest';
import { GlobalAtlas } from './GlobalAtlas';

const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';

interface Sat { name: string; norad: number; lat: number; lng: number; altKm: number; cls: string }
interface GpRow { OBJECT_NAME: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number }

const epochMs = (e: string) => Date.parse(e.endsWith('Z') ? e : e + 'Z');

const FREE_SOURCES: { name: string; provider: string; note: string }[] = [
  { name: 'CelesTrak TLE catalog', provider: 'CelesTrak', note: '16,894 active satellites (positions propagated client-side)' },
  { name: 'USGS FDSN earthquakes', provider: 'USGS', note: 'real-time seismicity, M2.5+ past month' },
  { name: 'NASA EONET v3', provider: 'NASA', note: 'floods, storms, volcanoes, fires, ice' },
  { name: 'NASA FIRMS', provider: 'NASA LANCE', note: 'MODIS + VIIRS active fire detections (24 h)' },
  { name: 'NOAA SWPC', provider: 'NOAA', note: 'Kp index + solar wind (space weather)' },
  { name: 'NASA POWER', provider: 'NASA LaRC', note: 'MERRA-2 climate (temperature, soil wetness)' },
  { name: 'MET Norway Yr', provider: 'MET Norway', note: '7-day weather forecast, keyless' },
  { name: 'Open-Meteo archive', provider: 'Open-Meteo', note: '26-year daily weather history' },
  { name: 'NASA EPIC / DSCOVR', provider: 'NASA', note: 'daily full-disk Earth image' },
  { name: 'NASA GIBS', provider: 'NASA', note: 'satellite imagery tiles (MODIS/VIIRS true colour)' },
  { name: 'NASA DONKI', provider: 'NASA CCMC', note: 'coronal mass ejections' },
  { name: 'ASF SAR catalog', provider: 'NASA ASF DAAC', note: 'NISAR / Sentinel-1 metadata (downloads need Earthdata)' },
  { name: 'Data.norge.no', provider: 'Digdir (FDK)', note: 'Norwegian open-data catalog — NVE flood/landslide hazards, DSB preparedness (server-side harvest)' },
];


/** Earth radius used for every altitude conversion on this board (km). */
const EARTH_R_KM = 6371;

/** Named shells, in km above the surface — the reference the ladder draws. */
const SHELLS = [
  { key: 'starlink', label: 'Starlink', km: 550, color: '#38bdf8' },
  { key: 'leo', label: 'LEO / ISS', km: 420, color: '#34d399' },
  { key: 'meo', label: 'GPS MEO', km: 20200, color: '#a78bfa' },
  { key: 'geo', label: 'GEO', km: 35786, color: '#f472b6' },
];

/**
 * Altitude ladder: Earth drawn at radius R, then each shell at (R + altitude) / R.
 * It is the legend the globe cannot provide on its own — at true scale LEO is a
 * 1.5 % ring above the surface and GEO is 5.6 radii out, and you cannot read that
 * from a sphere alone.
 */
function ScaleLadder({
  scaleMode,
  setScaleMode,
  filter,
  counts,
}: {
  scaleMode: 'true' | 'x4';
  setScaleMode: (m: 'true' | 'x4') => void;
  filter: string;
  counts: Record<string, number>;
}) {
  const maxR = (EARTH_R_KM + 35786) / EARTH_R_KM; // 6.62 R⊕ to the GEO shell
  const cx = 74;
  const cy = 74;
  const unit = 58 / maxR; // px per Earth radius
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1.5 backdrop-blur">
      <div className="flex items-center gap-1">
        {(['true', 'x4'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setScaleMode(m)}
            className={`rounded border px-1.5 py-0.5 text-[9px] ${scaleMode === m ? 'border-sky-300/50 bg-sky-500/20 text-white' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}
            title={m === 'true' ? 'altitudes exactly to scale' : 'every shell lifted ×4, ordering preserved'}
          >
            {m === 'true' ? 'true scale' : '×4 lifted'}
          </button>
        ))}
      </div>
      <svg width="150" height="150" viewBox="0 0 150 150" className="mt-1">
        <circle cx={cx} cy={cy} r={unit} fill="#0b2a6b" fillOpacity="0.55" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="1" />
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="7" fill="#93c5fd">Earth R</text>
        {SHELLS.map((sh) => {
          const r = unit * ((EARTH_R_KM + sh.km) / EARTH_R_KM);
          const on = filter === 'all' || filter === sh.key;
          return (
            <g key={sh.key} opacity={on ? 1 : 0.28}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={sh.color} strokeWidth={on ? 1.1 : 0.7} strokeDasharray={sh.key === 'geo' ? '0' : '2 2'} />
              <text x={cx} y={cy - r - 2} textAnchor="middle" fontSize="6.5" fill={sh.color}>
                {sh.label} {(sh.km / EARTH_R_KM).toFixed(2)}R⊕
              </text>
            </g>
          );
        })}
        <text x={2} y={146} fontSize="6" fill="#475569">1 R⊕ = 6,371 km</text>
      </svg>
      <div className="flex flex-wrap gap-x-2 text-[8px] text-slate-400">
        {SHELLS.map((sh) => (
          <span key={sh.key}>
            <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: sh.color }} />
            {sh.km.toLocaleString('en-US')} km{counts[sh.key] != null ? ` · ${counts[sh.key]}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SituationRoom() {
  const [sats, setSats] = useState<Sat[] | null>(null);
  const [satErr, setSatErr] = useState<string | null>(null);
  const [db, setDb] = useState<EventsDB | null>(null);
  const [firms, setFirms] = useState<FirmsGrid | null>(null);
  const [space, setSpace] = useState<SpaceHarvest | null>(null);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [posTime, setPosTime] = useState<string>('—');
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [rows, setRows] = useState<GpRow[] | null>(null);
  const [scaleMode, setScaleMode] = useState<'true' | 'x4'>('true');
  const [simSpeed, setSimSpeed] = useState(60);
  const baseRef = useRef(Date.now());

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(CELESTRAK, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((catalog: GpRow[]) => { setRows(catalog); setSatErr(null); })
      .catch((e) => {
        fetch('/data/live/satellites.json')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no fallback'))))
          .then((j: { sample?: any[] }) => { setRows((j.sample ?? []).map((s): GpRow => ({ OBJECT_NAME: s.name, NORAD_CAT_ID: s.norad, EPOCH: s.epoch, MEAN_MOTION: s.mean_motion, ECCENTRICITY: s.eccentricity, INCLINATION: s.inclination, RA_OF_ASC_NODE: s.raan, ARG_OF_PERICENTER: s.arg_perigee, MEAN_ANOMALY: s.mean_anomaly }))); setSatErr(`live catalog blocked (${String(e).replace(/^Error: /, '')}); using the ${(j.sample ?? []).length}-satellite harvest`); })
          .catch(() => setSatErr(String(e)));
      })
      .finally(() => clearTimeout(timer));
    loadEvents('harvest').then(setDb).catch(() => {});
    loadFirms().then(setFirms).catch(() => {});
    loadSpace().then(setSpace).catch(() => {});
  }, []);

  useEffect(() => {
    if (!rows) return;
    const propagate = () => {
      const virtualNow = baseRef.current + (Date.now() - baseRef.current) * simSpeed;
      const out: Sat[] = rows.map((c) => {
        const p = gpPosition({ meanMotionRevDay: c.MEAN_MOTION, eccentricity: c.ECCENTRICITY, inclinationDeg: c.INCLINATION, raanDeg: c.RA_OF_ASC_NODE, argPerigeeDeg: c.ARG_OF_PERICENTER, meanAnomalyDeg: c.MEAN_ANOMALY, epochMs: epochMs(c.EPOCH) }, virtualNow);
        return { name: c.OBJECT_NAME, norad: c.NORAD_CAT_ID, lat: p.lat, lng: p.lon, altKm: p.altKm, cls: orbitClass(c.OBJECT_NAME, p.altKm, c.ECCENTRICITY, c.INCLINATION) };
      });
      setSats(out);
      setPosTime(new Date(virtualNow).toISOString().slice(11, 19) + ' UTC');
    };
    propagate();
    const id = setInterval(propagate, 1000);
    return () => clearInterval(id);
  }, [rows, simSpeed]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);
  useEffect(() => {
    const g = globeRef.current; if (!g || !size.w) return;
    g.pointOfView({ lat: 15, lng: 0, altitude: 9.5 }, 0);
    const c = g.controls() as any;
    c.autoRotate = true; c.autoRotateSpeed = 0.25; c.enableZoom = true;
  }, [size.w > 0]);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#ffffff'), emissive: new Color('#0b2a6b'), emissiveIntensity: 0.6, shininess: 12 }), []);
  const shown = useMemo(() => (sats ? (filter === 'all' ? sats : sats.filter((s) => s.cls === filter)) : []), [sats, filter]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; if (sats) for (const s of sats) c[s.cls] = (c[s.cls] ?? 0) + 1; return c; }, [sats]);

  const recentQuakes = useMemo(() => (db ? db.events.filter((e) => e.type === 'earthquake' && (e.mag ?? 0) >= 4.5).sort((a, b) => b.t - a.t).slice(0, 8) : []), [db]);
  const last7d = (t: string) => db ? db.events.filter((e) => e.type === t && db.refTime - e.t < 7 * 86400000).length : 0;
  const kp = space?.swpc.kp_latest_est?.[1] ?? null;
  const clock = new Date(now).toUTCString().slice(17, 25);

  return (
    <div className="flex flex-col gap-3">
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-2"><Icon name="Target" className="h-6 w-6 text-rose-300" /></div>
            <div>
              <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-white">Earth Situation Room</h1><StatusBadge status="live" note={`positions ${posTime}`} /></div>
              <p className="text-xs text-slate-400">Every satellite, every crisis, every sensor — one real-time picture for situational awareness.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold text-sky-300">{clock}<span className="text-xs text-slate-500"> UTC</span></div>
            <div className="text-[11px] text-slate-500">{sats ? `${sats.length.toLocaleString('en-US')} satellites tracked` : 'loading catalog…'}</div>
          </div>
        </div>
        {satErr && <p className="mt-2 text-[11px] text-amber-300">Satellite catalog unavailable ({satErr}). Crisis panels still live.</p>}
      </Glass>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-3">
        <Glass className="relative overflow-hidden p-0">
          <div ref={wrap} className="h-[520px] w-full">
            {size.w > 0 && (
              <Globe
                ref={globeRef}
                width={size.w}
                height={size.h}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="/textures/earth.jpg"
                globeMaterial={material}
                showAtmosphere
                atmosphereColor="#f43f5e"
                atmosphereAltitude={0.2}
                pointsData={shown}
                pointLat="lat"
                pointLng="lng"
                pointColor={(d: any) => ORBIT_CLASSES[d.cls]?.color ?? '#94a3b8'}
                pointAltitude={(d: any) => {
                  // globe.gl altitude is in Earth radii, so the honest value is alt / R_earth.
                  // 'x4' lifts every shell by the same factor, which keeps the ordering true
                  // while making LEO visible at the same time as GEO — the caption says so.
                  const r = d.altKm / EARTH_R_KM;
                  return scaleMode === 'x4' ? Math.max(0.02, r * 4) : r;
                }}
                pointRadius={(d: any) => (d.cls === 'geo' ? 0.2 : 0.13)}
                pointsMerge={false}
                pointLabel={(d: any) => `<div style="background:#0b1229ee;border:1px solid #38bdf855;padding:5px 8px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${d.name}</b><br/>NORAD ${d.norad} · ${ORBIT_CLASSES[d.cls]?.label ?? d.cls}<br/><span style="color:#94a3b8">${d.altKm.toFixed(0)} km · ${d.lat.toFixed(1)}°, ${d.lng.toFixed(1)}°</span></div>`}
              />
            )}
          </div>
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {(['all', 'leo', 'meo', 'geo', 'starlink'] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-2 py-0.5 text-[11px] ${filter === k ? 'border-sky-300/50 bg-sky-500/20 text-white' : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'}`}>
                {k === 'all' ? 'All' : ORBIT_CLASSES[k].label}{k === 'all' ? ` ${sats?.length ?? 0}` : ` ${counts[k] ?? 0}`}
              </button>
            ))}
          </div>
          <div className="absolute left-3 top-14 flex flex-wrap items-center gap-1">
            <span className="px-0.5 text-[9px] uppercase tracking-wide text-slate-500">orbit</span>
            {([1, 60, 360] as const).map((s) => (
              <button key={s} onClick={() => { baseRef.current = Date.now(); setSimSpeed(s); }} className={`rounded-full border px-2 py-0.5 text-[10px] ${simSpeed === s ? 'border-sky-300/50 bg-sky-500/20 text-white' : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'}`}>{s}×</button>
            ))}
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
            <ScaleLadder scaleMode={scaleMode} setScaleMode={setScaleMode} filter={filter} counts={counts} />
            <div className="max-w-[46%] text-right text-[9px] leading-snug text-slate-500">
              Every dot sits at its true altitude in Earth radii: LEO ≈ 0.09 R⊕, GPS MEO ≈ 3.17 R⊕, GEO ≈ 5.62 R⊕.
              Drag to rotate, scroll to zoom.
            </div>
          </div>
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2 text-[10px]">
            {Object.entries(ORBIT_CLASSES).map(([k, v]) => <span key={k} className="flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</span>)}
          </div>
        </Glass>

        <div className="flex flex-col gap-3">
          <Glass className="p-3">
            <div className="h-title">Live situation</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Stat label="M4.5+ quakes (30 d)" value={String(recentQuakes.length > 0 ? recentQuakes.length : db ? db.events.filter((e) => e.type === 'earthquake' && (e.mag ?? 0) >= 4.5).length : '—')} color="#f59e0b" />
              <Stat label="Floods (7 d)" value={String(last7d('floods'))} color="#3b82f6" />
              <Stat label="Storms (7 d)" value={String(last7d('severeStorms'))} color="#a78bfa" />
              <Stat label="Fire detections (24 h)" value={firms ? firms.detections.toLocaleString('en-US') : '—'} color="#ef4444" />
              <Stat label="Kp index" value={kp != null ? kp.toFixed(1) : '—'} color={kp != null && kp >= 5 ? '#ef4444' : '#34d399'} />
              <Stat label="Volcanoes (active)" value={String(last7d('volcanoes'))} color="#f97316" />
            </div>
          </Glass>

          <Glass className="p-3">
            <div className="flex items-center justify-between"><div className="h-title">Latest M4.5+ seismic</div>{db && <StatusBadge status={db.status} note={db.label} />}</div>
            <ul className="scroll-thin mt-2 max-h-44 space-y-1 overflow-y-auto text-[11px]">
              {recentQuakes.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-white/5"><span className="truncate text-slate-200">{e.title}</span><span className="shrink-0 font-mono text-slate-500">{e.mag?.toFixed(1)}</span></li>)}
              {!recentQuakes.length && <li className="p-2 text-slate-500">No M4.5+ events in the active source.</li>}
            </ul>
          </Glass>

          <Glass className="p-3">
            <div className="h-title">Free keyless data sources</div>
            <ul className="scroll-thin mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px]">
              {FREE_SOURCES.map((s) => <li key={s.name} className="border-b border-white/5 py-1"><div className="flex justify-between"><span className="text-slate-200">{s.name}</span><span className="text-slate-500">{s.provider}</span></div><div className="text-slate-500">{s.note}</div></li>)}
            </ul>
          </Glass>
        </div>
      </div>

      <Glass className="p-3 text-[11px] text-slate-400">
        <div className="flex items-start gap-2"><Icon name="ShieldCheck" className="mt-0.5 h-4 w-4 text-sky-300" /><span><b className="text-slate-200">Honesty:</b> satellite positions are approximate Keplerian propagation of CelesTrak TLEs (no J2/drag/SGP4). Events and fires are real USGS / NASA EONET / FIRMS harvests; space weather is NOAA SWPC. This is a situational-awareness view, <b>not</b> a warning or defense-grading system.</span></div>
      </Glass>

      <GlobalAtlas />
    </div>
  );
}

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
    <div className="text-lg font-bold" style={{ color }}>{value}</div>
    <div className="text-[10px] text-slate-500">{label}</div>
  </div>
);
