import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { eventEvidence, flagEvidence, TYPE_META, type EventsDB, type OrbitEvent } from '../data/events';
import { firmsCellEvidence, gibsTileUrl, gibsTime, loadFirms, loadGibs, type FirmsGrid, type GibsLayer } from '../data/harvest';
import { useStore } from '../state/store';

interface Pt { kind: 'event' | 'firms'; lat: number; lng: number; type: string; count: number; sample?: OrbitEvent; cell?: FirmsGrid['cells'][number] }
export interface GlobeFocus { lat: number; lng: number; altitude?: number }

export function OrbitGlobe({ db, focus, types, height, autoRotate = false, initial = { lat: 30, lng: 12, altitude: 2.15 }, layerSelector = true, defaultLayer = 'bluemarble', showFirms = true }: { db: EventsDB | null; focus?: GlobeFocus | null; types?: string[]; height?: number; autoRotate?: boolean; initial?: GlobeFocus; layerSelector?: boolean; defaultLayer?: string; showFirms?: boolean }) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [firms, setFirms] = useState<FirmsGrid | null>(null);
  const [layers, setLayers] = useState<GibsLayer[]>([]);
  const [layerId, setLayerId] = useState(defaultLayer);
  const { openEvidence } = useStore();

  useEffect(() => { loadFirms().then(setFirms).catch(() => {}); loadGibs().then((g) => setLayers(g.layers)).catch(() => {}); }, []);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: height ?? el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, [height]);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#ffffff'), emissive: new Color('#0b2a6b'), emissiveIntensity: 0.6, shininess: 12 }), []);
  const layer = layers.find((l) => l.id === layerId) ?? null;
  const tileFn = useMemo(() => (layer ? gibsTileUrl(layer, gibsTime(layer)) : undefined), [layer]);

  const pts = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    if (db) {
      const m = new Map<string, Pt>();
      for (const e of db.events) {
        if (types && !types.includes(e.type)) continue;
        if (showFirms && firms && e.type === 'wildfires' && db.source === 'shards') continue; // avoid double fire layers
        const k = `${e.type}|${Math.floor(e.lat)}|${Math.floor(e.lon)}`;
        const c = m.get(k);
        if (c) c.count++; else m.set(k, { kind: 'event', lat: Math.floor(e.lat) + 0.5, lng: Math.floor(e.lon) + 0.5, type: e.type, count: 1, sample: e });
      }
      out.push(...m.values());
    }
    if (showFirms && firms && (!types || types.includes('wildfires'))) for (const c of firms.cells) out.push({ kind: 'firms', lat: c[0], lng: c[1], type: 'firms', count: c[2], cell: c });
    return out;
  }, [db, types, firms, showFirms]);
  const flags = useMemo(() => (db ? db.flags.filter((f) => !types || types.includes(f.type)) : []), [db, types]);

  useEffect(() => {
    const g = ref.current; if (!g || !size.w) return;
    g.pointOfView(initial, 0);
    const c = g.controls() as any;
    c.autoRotate = autoRotate; c.autoRotateSpeed = 0.35; c.enableZoom = true;
  }, [size.w > 0]);
  useEffect(() => { if (focus && ref.current) { (ref.current.controls() as any).autoRotate = false; ref.current.pointOfView({ altitude: 1.8, ...focus }, 1200); } }, [focus]);

  const color = (d: Pt) => (d.kind === 'firms' ? (d.count > 200 ? '#fde047' : d.count > 40 ? '#fb923c' : '#f87171') : TYPE_META[d.type]?.color ?? '#fff');
  return (
    <div ref={wrap} className="globe-wrap relative h-full w-full overflow-hidden">
      {size.w > 0 && (
        <Globe
          ref={ref}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={tileFn ? null : '/textures/earth.jpg'}
          globeTileEngineUrl={tileFn as any}
          globeMaterial={material}
          showAtmosphere
          atmosphereColor="#4aa8ff"
          atmosphereAltitude={0.25}
          pointsData={pts}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => color(d)}
          pointAltitude={(d: any) => (d.kind === 'firms' ? Math.min(0.05, 0.002 + Math.log10(d.count + 1) * 0.012) : Math.min(0.12, 0.004 + Math.log10(d.count + 1) * 0.03))}
          pointRadius={(d: any) => (d.kind === 'firms' ? 0.22 : d.type === 'earthquake' ? 0.26 : 0.36)}
          pointsMerge={false}
          pointLabel={(d: any) => `<div style="background:#0b1229ee;border:1px solid #38bdf855;padding:6px 8px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${d.kind === 'firms' ? 'FIRMS active fire' : TYPE_META[d.type]?.label ?? d.type}</b><br/>${d.count.toLocaleString('en-US')} ${d.kind === 'firms' ? 'detection(s), 24 h' : 'record(s)'} in 1° cell<br/><span style="color:${(d.kind === 'firms' || db?.status === 'live') ? '#34d399' : '#38bdf8'}">${d.kind === 'firms' ? firms?.label : db?.label}</span> · click for evidence</div>`}
          onPointClick={(d: any) => {
            if (d.kind === 'firms' && firms) return openEvidence(firmsCellEvidence(firms, d.cell));
            if (!db) return;
            const f = flags.find((x) => x.type === d.type && Math.abs(x.lat - d.lat) <= 1.5 && Math.abs(x.lon - d.lng) <= 1.5);
            openEvidence(f ? flagEvidence(db, f) : eventEvidence(db, d.sample));
          }}
          ringsData={flags}
          ringLat="lat"
          ringLng="lon"
          ringColor={(d: any) => (t: number) => `${(TYPE_META[d.type]?.color ?? '#ffffff')}${Math.round((1 - t) * 255).toString(16).padStart(2, '0')}`}
          ringMaxRadius={4}
          ringPropagationSpeed={2.2}
          ringRepeatPeriod={1100}
        />
      )}
      {layerSelector && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] backdrop-blur">
          <span className="text-slate-400">Imagery</span>
          <select aria-label="Globe imagery layer" className="bg-transparent text-slate-100 outline-none" value={layerId} onChange={(e) => setLayerId(e.target.value)}>
            <option className="bg-slate-900" value="bluemarble">Blue Marble (bundled)</option>
            {layers.map((l) => <option className="bg-slate-900" key={l.id} value={l.id}>GIBS · {l.title}</option>)}
          </select>
          {layer && <span className="text-emerald-300" title={`NASA GIBS WMTS ${layer.tms}, layer listed in the collector harvest`}>live tiles · {gibsTime(layer)}</span>}
        </div>
      )}
    </div>
  );
}
