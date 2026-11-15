import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { NarrationButton } from '../components/Narration';
import { backscatterChange, simulateSarPair } from '../kernel';
import { ConnectorLines, useGlobeConnectors } from '../components/ConnectorLines';
import { SarSiteIntel } from './SarSiteIntel';
import type { GlobeProject } from '../components/OrbitGlobe';

/* ------------------------------------------------------------------ *
 * SAR Earth Atlas — "Dancing with the SARs" mapped to Earth.
 * The 8 study areas are ranked by how much radar change the ORBIT SAR
 * kernel detects (synthetic before/after pairs, seeded & reproducible),
 * then plotted on a globe with live ASF acquisition timing. The
 * synthetic rasters are SAMPLE; acquisition counts/times are LIVE ASF.
 * ------------------------------------------------------------------ */

interface Site { id: string; name: string; region: string; lat: number; lon: number; scenario: string }
interface Scored extends Site { changedPct: number; changedCells: number; areaKm2: number }

const SITES: Site[] = [
  { id: 'sfbay', name: 'San Francisco Bay', region: 'California, USA', lat: 37.75, lon: -122.25, scenario: 'urban' },
  { id: 'iceland', name: 'Iceland rift & volcano', region: 'Southwest Iceland', lat: 64.15, lon: -20.9, scenario: 'glacier' },
  { id: 'amazon', name: 'Amazon frontier', region: 'Amazonas, Brazil', lat: -3.0, lon: -60.0, scenario: 'deforestation' },
  { id: 'alps', name: 'Swiss Alps (ice)', region: 'Valais, Switzerland', lat: 46.1, lon: 7.5, scenario: 'glacier' },
  { id: 'sahel', name: 'Sahel wetlands', region: 'Niger', lat: 13.5, lon: 2.1, scenario: 'flood' },
  { id: 'oslo', name: 'Oslo', region: 'Norway', lat: 59.91, lon: 10.75, scenario: 'urban' },
  { id: 'greenland', name: 'Ilulissat glacier', region: 'Greenland', lat: 69.22, lon: -51.1, scenario: 'glacier' },
  { id: 'mekong', name: 'Mekong Delta', region: 'Vietnam', lat: 10.0, lon: 105.7, scenario: 'flood' },
];

const sevColor = (pct: number) => (pct >= 0.25 ? '#f43f5e' : pct >= 0.15 ? '#f97316' : pct >= 0.08 ? '#facc15' : '#22d3ee');

async function fetchAsfCount(bbox: [number, number, number, number]): Promise<{ n: number; latest: string | null }> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  try {
    const [n1, s1] = await Promise.all([
      fetch(`https://api.daac.asf.alaska.edu/services/search/param?platform=NISAR&bbox=${minLon},${minLat},${maxLon},${maxLat}&output=json&maxResults=50`, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`https://api.daac.asf.alaska.edu/services/search/param?platform=Sentinel-1A&bbox=${minLon},${minLat},${maxLon},${maxLat}&output=json&maxResults=50`, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.reject())),
    ]);
    const flat = (j: unknown): any[] => (Array.isArray(j) ? (Array.isArray(j[0]) ? j[0] : j) : ((j as any)?.results ?? []));
    const all = [...flat(n1), ...flat(s1)];
    const times = all.map((g: any) => g?.startTime).filter(Boolean).sort();
    return { n: all.length, latest: times[times.length - 1] ?? null };
  } catch {
    return { n: 0, latest: null };
  }
}

export function SarGlobe() {
  const [sel, setSel] = useState<string>(SITES[0].id);
  const [asf, setAsf] = useState<{ n: number; latest: string | null } | null>(null);
  const [asfState, setAsfState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement | null>());
  const [project, setProject] = useState<GlobeProject | null>(null);

  // Rank every study area with the real SAR kernel (synthetic, seeded pairs).
  // The change-region radius varies per site so the "best change" ranking is real.
  const RADII = [0.4, 0.22, 0.3, 0.16, 0.48, 0.14, 0.2, 0.38];
  const scored = useMemo<Scored[]>(() =>
    SITES.map((s, i) => {
      const pair = simulateSarPair(s.scenario, { seed: 7 + i, size: 44, extent: [s.lon - 0.4, s.lat - 0.32, s.lon + 0.4, s.lat + 0.32], radius: 44 * RADII[i] });
      const ch = backscatterChange(pair.before, pair.after, { thresholdDb: 3 });
      return { ...s, changedPct: ch.changedPct, changedCells: ch.changedCells, areaKm2: ch.areaKm2 };
    }).sort((a, b) => b.changedPct - a.changedPct), []);

  const top = scored.slice(0, 3).map((s) => s.id);

  // lat/lng -> canvas pixels, so the connector pins follow the globe
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    setProject(() => (lat: number, lng: number) => {
      try {
        const c = g.getScreenCoords(lat, lng, 0);
        return c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { x: c.x, y: c.y } : null;
      } catch {
        return null;
      }
    });
  }, [size.w, size.h]);

  // the ranked list is the anchor: every dot on the globe connects to its row
  const connectorPoints = useMemo(
    () =>
      scored.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lon,
        color: sevColor(s.changedPct),
        label: `${s.name} · ${(s.changedPct * 100).toFixed(0)}%`,
        weight: s.id === sel ? 1 : top.includes(s.id) ? 0.75 : 0.4,
      })),
    [scored, sel, top],
  );
  const anchorEls = useCallback(() => rowEls.current, []);
  const { pins, anchors } = useGlobeConnectors({
    project,
    points: connectorPoints,
    containerRef: gridRef,
    globeRectRef: wrap,
    anchorEls,
  });
  const current = scored.find((s) => s.id === sel)!;

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    setAsfState('loading');
    const bbox: [number, number, number, number] = [current.lon - 1, current.lat - 1, current.lon + 1, current.lat + 1];
    fetchAsfCount(bbox).then((r) => { if (alive) { setAsf(r); setAsfState(r.n > 0 ? 'ok' : 'err'); } });
    return () => { alive = false; };
  }, [sel]);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#ffffff'), emissive: new Color('#0b2a6b'), emissiveIntensity: 0.6, shininess: 12 }), []);

  return (
    <>
    <Glass className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2"><Icon name="Radio" className="h-5 w-5 text-teal-300" /><span className="h-title">SAR Earth Atlas</span><StatusBadge status="live" note="ASF acquisitions · live" /><NarrationButton src="/assets/audio/sar-atlas.mp3" label="Listen" /></div>
        <span className="text-[11px] text-slate-500">8 study areas · ranked by detected radar change · click any marker</span>
      </div>

      <div ref={gridRef} className="relative grid grid-cols-[minmax(0,1fr)_280px]">
        <div ref={wrap} className="relative h-[460px]">
          {size.w > 0 && (
            <Globe
              ref={globeRef}
              width={size.w}
              height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="/textures/earth.jpg"
              globeMaterial={material}
              showAtmosphere
              atmosphereColor="#2dd4bf"
              atmosphereAltitude={0.22}
              pointsData={scored}
              pointLat="lat"
              pointLng="lon"
              pointColor={(d: any) => sevColor(d.changedPct)}
              pointAltitude={(d: any) => 0.02 + Math.min(0.06, d.changedPct * 0.3)}
              pointRadius={(d: any) => (d.id === sel ? 0.42 : 0.28)}
              pointsMerge={false}
              pointLabel={(d: any) => `<div style="background:#0b1229ee;border:1px solid #2dd4bf55;padding:6px 8px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${d.name}</b><br/><span style="color:#94a3b8">${d.region}</span><br/><span style="color:#f97316">${(d.changedPct * 100).toFixed(1)}% cells changed · ${d.changedCells} cells</span></div>`}
              onPointClick={(d: any) => setSel(d.id)}
              ringsData={scored.filter((s) => top.includes(s.id))}
              ringLat="lat"
              ringLng="lon"
              ringColor={(d: any) => (t: number) => `${sevColor(d.changedPct)}${Math.round((1 - t) * 255).toString(16).padStart(2, '0')}`}
              ringMaxRadius={3.5}
              ringPropagationSpeed={2}
              ringRepeatPeriod={1000}
            />
          )}
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-2 text-[10px]">
            {[['High', '#f43f5e'], ['Elevated', '#f97316'], ['Moderate', '#facc15'], ['Low', '#22d3ee']].map(([l, c]) => <span key={l} className="flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l} change</span>)}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-l border-white/10 p-3">
          <Glass className="p-3">
            <div className="h-title">Best change locations</div>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              {scored.map((s, i) => (
                <li key={s.id}>
                  <button ref={(el) => { rowEls.current.set(s.id, el); }} onClick={() => setSel(s.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${sel === s.id ? 'bg-teal-500/15' : 'hover:bg-white/5'}`}>
                    <span className="w-4 text-[10px] font-bold text-slate-500">{i + 1}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sevColor(s.changedPct) }} />
                    <span className="flex-1 truncate text-slate-200">{s.name}</span>
                    <span className="tabular-nums text-slate-400">{(s.changedPct * 100).toFixed(0)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </Glass>

          <Glass className="p-3">
            <div className="flex items-center justify-between"><div className="h-title">{current.name}</div><Chip className="border-teal-400/30 text-teal-200">{current.scenario}</Chip></div>
            <div className="mt-1 text-[10px] text-slate-500">{current.region} · {current.lat.toFixed(2)}°, {current.lon.toFixed(2)}°</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-white/10 bg-white/[.03] p-2"><div className="text-slate-400">Changed cells</div><div className="text-lg font-bold text-white">{current.changedCells}</div></div>
              <div className="rounded-md border border-white/10 bg-white/[.03] p-2"><div className="text-slate-400">Affected area</div><div className="text-lg font-bold text-white">{current.areaKm2.toFixed(0)} km²</div></div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
              <span className="text-slate-400">ASF acquisitions (1° box)</span>
              <span className="text-slate-300">
                {asfState === 'loading' ? 'querying…' : asfState === 'ok' && asf ? <><b className="text-white">{asf.n}</b> granules · latest {asf.latest?.slice(0, 10)}</> : 'none'}
              </span>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">Change % is from the SAMPLE synthetic before/after pairs (seeded, reproducible) — the acquisition counts and times are live ASF.</p>
          </Glass>
        </div>

        {/* pins on the globe -> rows in the ranked list (and the reverse on select) */}
        <ConnectorLines pins={pins} anchors={anchors} />
      </div>
    </Glass>

    <div className="mt-3">
      <SarSiteIntel site={{ id: current.id, name: current.name, region: current.region, lat: current.lat, lon: current.lon }} />
    </div>
    </>
  );
}

export default SarGlobe;
