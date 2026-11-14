import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { loadEvents, TYPE_META, isoMin, type EventsDB, type OrbitEvent } from '../data/events';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { NarrationButton } from '../components/Narration';
import { useStore } from '../state/store';

// Per-type duration for the timeline (heuristic; the snapshot carries a point time, not an end).
// Earthquakes are instantaneous (shown briefly). Wildfires/floods/volcanoes persist for a
// representative span so the twin can show "start → end".
const DURATION: Record<string, number> = {
  earthquake: 0,
  wildfires: 3 * 86400000,
  floods: 7 * 86400000,
  severeStorms: 2 * 86400000,
  volcanoes: 30 * 86400000,
  seaLakeIce: 90 * 86400000,
};
const FLASH = 1.5 * 86400000;

// Live weather sites for the twin (MET Norway Yr, locationforecast/2.0, keyless).
const TWIN_SITES = [
  { lat: 59.91, lon: 10.75, label: 'Oslo' },
  { lat: 78.22, lon: 15.65, label: 'Svalbard' },
  { lat: 60.0, lon: -30.0, label: 'N. Atlantic' },
  { lat: 13.5, lon: 2.1, label: 'Sahel' },
  { lat: 37.77, lon: -122.42, label: 'California' },
];
const WEATHER_EMOJI: Record<string, string> = { clearsky_day: '☀️', clearsky_night: '🌙', fair_day: '🌤️', fair_night: '🌙', partlycloudy_day: '⛅', partlycloudy_night: '☁️', cloudy: '☁️', lightrain: '🌦️', rain: '🌧️', heavyrain: '🌧️', rainshowers_day: '🌦️', rainshowers_night: '🌧️', lightsnow: '🌨️', snow: '❄️', heavysnow: '❄️', lightsleet: '🌨️', sleet: '🌨️', fog: '🌫️' };
const wEmoji = (c: string) => WEATHER_EMOJI[c] ?? '·';
const tempColor = (t: number) => (t <= -10 ? '#67e8f9' : t <= 0 ? '#38bdf8' : t <= 10 ? '#22d3ee' : t <= 20 ? '#34d399' : t <= 30 ? '#fbbf24' : '#f87171');
interface TwinWeather { lat: number; lon: number; label: string; temp: number; wind: number; rh: number; code: string; updated: string }

const endOf = (e: OrbitEvent) => e.t + (DURATION[e.type] ?? 3 * 86400000);
const activeAt = (e: OrbitEvent, T: number) => (DURATION[e.type] === 0 ? e.t <= T && T <= e.t + FLASH : e.t <= T && T <= e.t + (DURATION[e.type] ?? 3 * 86400000));

export default function WorldTwin() {
  const { settings } = useStore();
  const [db, setDb] = useState<EventsDB | null>(null);
  const [T, setT] = useState<number>(Date.now());
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<OrbitEvent | null>(null);
  const [types, setTypes] = useState<string[]>(Object.keys(TYPE_META));
  const [minMag, setMinMag] = useState(5);
  const [weather, setWeather] = useState<TwinWeather[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  useEffect(() => { loadEvents(settings.dataSource).then(setDb).catch(() => {}); }, [settings.dataSource]);
  useEffect(() => {
    let alive = true;
    Promise.all(TWIN_SITES.map(async (s) => {
      try {
        const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${s.lat}&lon=${s.lon}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const cur = j.properties.timeseries[0];
        const inst = cur.data.instant.details;
        const code = cur.data.next_1_hours?.summary?.symbol_code ?? cur.data.next_6_hours?.summary?.symbol_code ?? '';
        return { lat: s.lat, lon: s.lon, label: s.label, temp: inst.air_temperature, wind: inst.wind_speed, rh: inst.relative_humidity, code, updated: j.properties.meta.updated_at };
      } catch { return null; }
    })).then((ws) => { if (alive) setWeather(ws.filter((x): x is TwinWeather => !!x)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const { minT, maxT } = useMemo(() => {
    if (!db || !db.events.length) return { minT: 0, maxT: 0 };
    const ts = db.events.map((e) => e.t);
    return { minT: Math.min(...ts), maxT: Math.max(...ts) };
  }, [db]);
  useEffect(() => { if (db && minT && maxT) setT(maxT); }, [db, minT, maxT]);

  useEffect(() => {
    if (!playing || !db) return;
    const step = Math.max(1, (maxT - minT) / 300);
    const id = setInterval(() => setT((t) => (t + step >= maxT ? minT : t + step)), 100);
    return () => clearInterval(id);
  }, [playing, db, minT, maxT]);

  const active = useMemo(() => (db ? db.events.filter((e) => activeAt(e, T) && types.includes(e.type) && (e.type !== 'earthquake' || (e.mag ?? 0) >= minMag)) : []), [db, T, types, minMag]);
  const points = useMemo(() => [...active.map((e) => ({ ...e, kind: 'event' as const })), ...weather.map((w) => ({ ...w, kind: 'weather' as const }))], [active, weather]);
  const histogram = useMemo(() => {
    if (!db) return [];
    const filtered = db.events.filter((e) => types.includes(e.type) && (e.type !== 'earthquake' || (e.mag ?? 0) >= minMag));
    const buckets = 96;
    const span = maxT - minT || 1;
    const counts = new Array(buckets).fill(0);
    for (const e of filtered) { const i = Math.min(buckets - 1, Math.floor(((e.t - minT) / span) * buckets)); counts[i]++; }
    const mx = Math.max(1, ...counts);
    return counts.map((c, i) => ({ x: minT + (i / buckets) * span, y: c / mx }));
  }, [db, minT, maxT, types, minMag]);

  const material = useMemo(() => new MeshPhongMaterial({ color: new Color('#ffffff'), emissive: new Color('#0b2a6b'), emissiveIntensity: 0.6, shininess: 12 }), []);
  const colorOf = (e: OrbitEvent) => TYPE_META[e.type]?.color ?? '#94a3b8';
  const dateLabel = (t: number) => new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const stepLabel = maxT > minT ? Math.round((maxT - minT) / 300 / 86400000) : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">World <span className="font-normal text-sky-300">Digital Twin</span></h1>
          <p className="text-sm text-slate-400">Every event in the catalogue, on a timeline — from the moment it starts to the moment it ends.</p>
        </div>
        <div className="flex items-center gap-2"><NarrationButton src="/assets/audio/world-digital-twin.mp3" label="Listen" />{db && <StatusBadge status={db.status} note={db.label} />}</div>
      </div>

      <Glass className="p-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Filter</span>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <button key={k} onClick={() => setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 transition ${types.includes(k) ? 'border-white/20 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><span className="h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-slate-400">Min quake magnitude
            <select aria-label="Minimum earthquake magnitude" className="input !w-auto !py-0.5 text-xs" value={minMag} onChange={(e) => setMinMag(+e.target.value)}>{[5, 5.5, 6, 6.5, 7].map((m) => <option key={m} value={m}>{m.toFixed(1)}</option>)}</select>
          </span>
        </div>
      </Glass>

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3">
        <Glass className="relative overflow-hidden p-0" >
          <div ref={wrap} className="h-[520px] w-full">
            {size.w > 0 && db && (
              <Globe
                ref={globeRef}
                width={size.w}
                height={size.h}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="/textures/earth.jpg"
                globeMaterial={material}
                showAtmosphere
                atmosphereColor="#4aa8ff"
                atmosphereAltitude={0.22}
                pointsData={points}
                pointLat="lat"
                pointLng="lon"
                pointColor={(d: any) => (d.kind === 'weather' ? tempColor(d.temp) : colorOf(d))}
                pointAltitude={(d: any) => (d.kind === 'weather' ? 0.04 : 0.02)}
                pointRadius={(d: any) => (d.kind === 'weather' ? 0.32 : d.type === 'earthquake' ? 0.18 : 0.26)}
                pointsMerge={false}
                pointLabel={(d: any) => d.kind === 'weather' ? `<div style="background:#0b1229ee;border:1px solid #22d3ee55;padding:6px 8px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${d.label}</b> · ${d.temp.toFixed(1)}°C ${wEmoji(d.code)}<br/><span style="color:#94a3b8">wind ${d.wind.toFixed(1)} m/s · ${d.rh.toFixed(0)}% RH · live Yr</span></div>` : `<div style="background:#0b1229ee;border:1px solid #38bdf855;padding:6px 8px;border-radius:8px;font:12px Inter,sans-serif;color:#e2e8f0"><b>${TYPE_META[d.type]?.label ?? d.type}</b><br/>${d.title.slice(0, 60)}<br/><span style="color:#94a3b8">${isoMin(d.t)}</span></div>`}
                onPointClick={(d: any) => d.kind === 'event' && setSelected(d)}
              />
            )}
          </div>
          {!db && <div className="grid h-[520px] place-items-center text-sm text-slate-500">Loading event catalogue…</div>}
        </Glass>

        <div className="flex flex-col gap-3">
          <Glass className="p-3">
            <div className="flex items-center justify-between"><div className="h-title">Live weather now</div>{weather[0] && <StatusBadge status="live" note={weather[0].updated.slice(0, 16).replace('T', ' ')} />}</div>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              {weather.map((w) => (
                <li key={w.label} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[.03] px-2 py-1.5">
                  <span className="flex items-center gap-1.5"><span className="text-sm">{wEmoji(w.code)}</span><span className="text-slate-200">{w.label}</span></span>
                  <span className="tabular-nums"><b className="text-white">{w.temp.toFixed(0)}°C</b> <span className="text-slate-500">· {w.wind.toFixed(0)} m/s</span></span>
                </li>
              ))}
              {!weather.length && <li className="p-2 text-slate-500">Loading live Yr weather…</li>}
            </ul>
            <p className="mt-1.5 text-[10px] text-slate-500">MET Norway Yr (locationforecast/2.0, keyless, CC BY 4.0) — live now-cast, weather markers on the globe are colour-coded by temperature.</p>
          </Glass>
          <Glass className="p-3">
            <div className="h-title">Now · {dateLabel(T)}</div>
            <div className="mt-1 text-3xl font-bold text-white">{active.length.toLocaleString('en-US')}</div>
            <div className="text-xs text-slate-400">events active at this moment</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              {Object.entries(TYPE_META).map(([k, v]) => {
                const c = active.filter((e) => e.type === k).length;
                return c > 0 ? <span key={k} className="rounded-full border border-white/10 px-2 py-0.5" style={{ color: v.color }}>{v.label} {c}</span> : null;
              })}
            </div>
          </Glass>
          <Glass className="p-3">
            <div className="h-title">Active now · {active.length.toLocaleString('en-US')}</div>
            <ul className="scroll-thin mt-1.5 max-h-44 space-y-0.5 overflow-y-auto text-[11px]">
              {active.slice(0, 150).map((e) => (
                <li key={e.id}><button onClick={() => setSelected(e)} className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-white/5 ${selected?.id === e.id ? 'bg-sky-500/15' : ''}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TYPE_META[e.type]?.color }} /><span className="truncate text-slate-200">{e.title}</span></button></li>
              ))}
              {!active.length && <li className="p-2 text-slate-500">No events match the filters at this moment.</li>}
            </ul>
          </Glass>
          <Glass className="p-3">
            <div className="h-title">Catalogue</div>
            <div className="mt-1 text-sm text-slate-200">{db ? db.events.length.toLocaleString('en-US') : '—'} records</div>
            <div className="text-xs text-slate-400">{db && minT ? `${new Date(minT).getFullYear()} → ${new Date(maxT).getFullYear()}` : '—'} · {Object.keys(TYPE_META).length} event types</div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">End times are approximate per-type durations (quakes are instantaneous). The source record carries a point time, not a precise end date.</p>
          </Glass>
          {selected && (
            <Glass className="p-3">
              <div className="flex items-center justify-between"><div className="h-title">{TYPE_META[selected.type]?.label}</div><button onClick={() => setSelected(null)} className="text-slate-500">✕</button></div>
              <div className="mt-1 text-sm font-semibold text-white">{selected.title}</div>
              <div className="mt-1 text-xs text-slate-400">Start: {isoMin(selected.t)}</div>
              <div className="text-xs text-slate-400">End: {DURATION[selected.type] === 0 ? 'instantaneous (point event)' : isoMin(endOf(selected))}</div>
              {selected.mag !== null && <div className="text-xs text-slate-300">Magnitude {selected.mag} {selected.unit ?? ''}</div>}
              {selected.url && <a className="mt-1 inline-block text-xs text-sky-300 hover:underline" href={selected.url} target="_blank" rel="noreferrer">source ↗</a>}
            </Glass>
          )}
        </div>
      </div>

      <Glass className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary !py-1.5 text-xs" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Play'} <span className="opacity-70">(~{Math.max(1, stepLabel)} d/frame)</span></button>
          <span className="font-mono text-xs text-sky-200">{dateLabel(minT)}</span>
          <input type="range" min={minT} max={maxT} value={T} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} className="flex-1" aria-label="Timeline" />
          <span className="font-mono text-xs text-sky-200">{dateLabel(maxT)}</span>
        </div>
        <div className="mt-2 flex h-10 items-end gap-[2px]">
          {histogram.map((b, i) => <div key={i} title={dateLabel(b.x)} className="flex-1 rounded-sm" style={{ height: `${Math.max(2, b.y * 100)}%`, background: b.x <= T ? '#38bdf8' : '#1e293b' }} />)}
        </div>
        <div className="mt-1 text-center text-[10px] text-slate-500">Monthly event density · lit up to {dateLabel(T)}</div>
      </Glass>
    </div>
  );
}
