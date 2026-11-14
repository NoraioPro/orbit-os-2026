import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { gpPosition, orbitClass, ORBIT_CLASSES } from '../kernel/orbit';
import { loadEvents, TYPE_META, type EventsDB } from '../data/events';
import { loadFirms, type FirmsGrid } from '../data/harvest';
import { CROP_REGIONS } from './CropWatch';
import { PLACES } from '../data/power';

const CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
const ANALOG_IDS = ['atacama', 'dryvalleys', 'deathvalley', 'iceland', 'svalbard', 'sahel', 'greenland', 'nile', 'andoya'];

const WEATHER_SITES = [
  { name: 'Oslo', lat: 59.91, lng: 10.75 },
  { name: 'Svalbard', lat: 78.22, lng: 15.65 },
  { name: 'North Atlantic', lat: 60.0, lng: -30.0 },
  { name: 'Sahel', lat: 13.5, lng: 2.1 },
  { name: 'California', lat: 37.77, lng: -122.42 },
];

type Layer = 'sat' | 'weather' | 'crop' | 'analog' | 'fire' | 'quake';
const LAYER_META: Record<Layer, { label: string; color: string; status: 'live' | 'snapshot' | 'sample' }> = {
  sat: { label: 'Satellites', color: '#38bdf8', status: 'live' },
  weather: { label: 'Weather stations', color: '#22d3ee', status: 'live' },
  crop: { label: 'Crop regions', color: '#34d399', status: 'live' },
  analog: { label: 'Analog sites', color: '#a78bfa', status: 'snapshot' },
  fire: { label: 'Active fires', color: '#f87171', status: 'live' },
  quake: { label: 'Earthquakes', color: '#fbbf24', status: 'live' },
};

interface Pt { layer: Layer; lat: number; lng: number; name: string; sub: string; color: string; r: number; alt: number }
interface GpRow { OBJECT_NAME: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number }

const epochMs = (e: string) => Date.parse(e.endsWith('Z') ? e : e + 'Z');

export function GlobalAtlas() {
  const [rows, setRows] = useState<GpRow[] | null>(null);
  const [satErr, setSatErr] = useState<string | null>(null);
  const [db, setDb] = useState<EventsDB | null>(null);
  const [firms, setFirms] = useState<FirmsGrid | null>(null);
  const [active, setActive] = useState<Record<Layer, boolean>>({ sat: true, weather: true, crop: true, analog: true, fire: true, quake: true });
  const [simSpeed, setSimSpeed] = useState(60);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
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
          .then((j: { sample?: any[] }) => { setRows((j.sample ?? []).map((s): GpRow => ({ OBJECT_NAME: s.name, NORAD_CAT_ID: s.norad, EPOCH: s.epoch, MEAN_MOTION: s.mean_motion, ECCENTRICITY: s.eccentricity, INCLINATION: s.inclination, RA_OF_ASC_NODE: s.raan, ARG_OF_PERICENTER: s.arg_perigee, MEAN_ANOMALY: s.mean_anomaly }))); setSatErr(`live catalog blocked; using the ${(j.sample ?? []).length}-satellite harvest`); })
          .catch(() => setSatErr(String(e)));
      })
      .finally(() => clearTimeout(timer));
    loadEvents('harvest').then(setDb).catch(() => {});
    loadFirms().then(setFirms).catch(() => {});
  }, []);

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#ffffff'), emissive: new Color('#0b2a6b'), emissiveIntensity: 0.6, shininess: 12 }), []);

  const sats = useMemo<Pt[]>(() => {
    if (!rows) return [];
    const virtualNow = baseRef.current + (Date.now() - baseRef.current) * simSpeed;
    return rows.map((c) => {
      const p = gpPosition({ meanMotionRevDay: c.MEAN_MOTION, eccentricity: c.ECCENTRICITY, inclinationDeg: c.INCLINATION, raanDeg: c.RA_OF_ASC_NODE, argPerigeeDeg: c.ARG_OF_PERICENTER, meanAnomalyDeg: c.MEAN_ANOMALY, epochMs: epochMs(c.EPOCH) }, virtualNow);
      const cls = orbitClass(c.OBJECT_NAME, p.altKm, c.ECCENTRICITY, c.INCLINATION);
      return { layer: 'sat', lat: p.lat, lng: p.lon, name: c.OBJECT_NAME, sub: `NORAD ${c.NORAD_CAT_ID} · ${ORBIT_CLASSES[cls]?.label ?? cls} · ${p.altKm.toFixed(0)} km`, color: ORBIT_CLASSES[cls]?.color ?? '#94a3b8', r: cls === 'geo' ? 0.22 : 0.13, alt: 0.02 };
    });
  }, [rows, simSpeed, tick]);

  const statics = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    for (const s of WEATHER_SITES) out.push({ layer: 'weather', lat: s.lat, lng: s.lng, name: s.name, sub: 'Open-Meteo / Yr daily archive', color: LAYER_META.weather.color, r: 0.4, alt: 0.02 });
    for (const c of CROP_REGIONS) out.push({ layer: 'crop', lat: c.lat, lng: c.lon, name: `${c.country} · ${c.region}`, sub: `${c.crop} · planted ${c.plantMonth}`, color: LAYER_META.crop.color, r: 0.26, alt: 0.015 });
    for (const id of ANALOG_IDS) { const p = PLACES.find((x) => x.id === id); if (p) out.push({ layer: 'analog', lat: p.lat, lng: p.lon, name: p.name, sub: `${p.country} · Mars/Moon analog`, color: LAYER_META.analog.color, r: 0.32, alt: 0.02 }); }
    return out;
  }, []);

  const fires = useMemo<Pt[]>(() => (firms ? firms.cells.map((c) => ({ layer: 'fire' as Layer, lat: c[0], lng: c[1], name: 'Active fire cell', sub: `${c[2].toLocaleString('en-US')} detections (24 h)`, color: c[2] > 200 ? '#fde047' : c[2] > 40 ? '#fb923c' : '#f87171', r: Math.min(0.4, 0.15 + Math.log10(c[2] + 1) * 0.09), alt: Math.min(0.06, 0.002 + Math.log10(c[2] + 1) * 0.012) })) : []), [firms]);

  const quakes = useMemo<Pt[]>(() => {
    if (!db) return [];
    return db.events.filter((e) => e.type === 'earthquake' && (e.mag ?? 0) >= 4.5).sort((a, b) => b.t - a.t).slice(0, 80).map((e) => ({ layer: 'quake' as Layer, lat: e.lat, lng: e.lon, name: e.title, sub: `M ${e.mag?.toFixed(1)} · ${new Date(e.t).toISOString().slice(0, 10)}`, color: LAYER_META.quake.color, r: Math.min(0.42, 0.18 + (e.mag ?? 0) * 0.03), alt: 0.02 }));
  }, [db]);

  const pts = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    if (active.sat) out.push(...sats);
    if (active.weather || active.crop || active.analog) out.push(...statics.filter((p) => active[p.layer]));
    if (active.fire) out.push(...fires);
    if (active.quake) out.push(...quakes);
    return out;
  }, [active, sats, statics, fires, quakes]);

  const counts: Record<Layer, number> = { sat: sats.length, weather: WEATHER_SITES.length, crop: CROP_REGIONS.length, analog: ANALOG_IDS.length, fire: fires.length, quake: quakes.length };

  return (
    <Glass className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="Earth" className="h-5 w-5 text-sky-300" />
          <span className="h-title">Global Atlas · where is everything</span>
          <StatusBadge status="live" note={`${pts.length.toLocaleString('en-US')} points plotted`} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">Sim speed</span>
          {([1, 60, 360] as const).map((s) => (
            <button key={s} onClick={() => setSimSpeed(s)} className={`rounded-full border px-2 py-0.5 ${simSpeed === s ? 'border-sky-300/50 bg-sky-500/20 text-white' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>{s}×</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {(Object.keys(LAYER_META) as Layer[]).map((k) => (
          <button key={k} onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition ${active[k] ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: LAYER_META[k].color, opacity: active[k] ? 1 : 0.35 }} />
            {LAYER_META[k].label}
            <span className="tabular-nums text-slate-400">{counts[k].toLocaleString('en-US')}</span>
          </button>
        ))}
      </div>

      <div ref={wrap} className="relative h-[560px] w-full">
        {size.w > 0 && (
          <Globe
            ref={globeRef}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="/textures/earth.jpg"
            globeMaterial={material}
            showAtmosphere
            atmosphereColor="#4aa8ff"
            atmosphereAltitude={0.25}
            pointsData={pts}
            pointLat="lat"
            pointLng="lng"
            pointColor={(d: any) => d.color}
            pointAltitude="alt"
            pointRadius="r"
            pointsMerge={false}
            pointLabel={(d: any) => `<div style="background:#0b1229ee;border:1px solid #38bdf855;padding:6px 9px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${d.name}</b><br/><span style="color:#94a3b8">${d.sub}</span><br/><span style="color:${d.color}">${LAYER_META[d.layer as Layer]?.label ?? d.layer}</span></div>`}
          />
        )}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2 text-[10px]">
          {Object.entries(ORBIT_CLASSES).map(([k, v]) => <span key={k} className="flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</span>)}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-400">
        {satErr && <span className="mr-3 text-amber-300">{satErr}.</span>}
        <Icon name="ShieldCheck" className="mr-1 inline h-3.5 w-3.5 text-sky-300" />
        Satellite positions are approximate Keplerian propagation of CelesTrak TLEs (no J2/drag/SGP4), animated at {simSpeed}×. Fires = NASA FIRMS 24 h, quakes = USGS M4.5+, weather/crop = Open-Meteo archives, analog sites = NASA POWER snapshot means. Statistical view — not a warning system.
      </div>
    </Glass>
  );
}

export default GlobalAtlas;
