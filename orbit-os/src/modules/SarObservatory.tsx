import { useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { NarrationButton } from '../components/Narration';
import { backscatterChange, classifyChange, phaseToDisplacement, relateEvents, simulateSarPair, SAR_MISSIONS, type SarRaster } from '../kernel';
import { useStore } from '../state/store';
import { TYPE_META, isoMin } from '../data/events';

const SCENARIOS = [
  { id: 'flood', name: 'Flood / wetland change', lat: 13.5, lon: 2.1, region: 'Sahel (Niamey)' },
  { id: 'urban', name: 'Urban growth', lat: 59.91, lon: 10.75, region: 'Oslo' },
  { id: 'deforestation', name: 'Forest disturbance', lat: -3.12, lon: -60.02, region: 'Amazon (Manaus)' },
  { id: 'glacier', name: 'Glacier / ice change', lat: 69.22, lon: -51.1, region: 'Greenland (Ilulissat)' },
];

const cmapDb = (v: number) => (v >= 6 ? '#a855f7' : v >= 3 ? '#f97316' : v <= -6 ? '#1d4ed8' : v <= -3 ? '#38bdf8' : '#111827');
const cmapDisp = (v: number) => (v > 0.02 ? '#ef4444' : v < -0.02 ? '#3b82f6' : '#0f172a');

function RasterGrid({ r, cmap }: { r: SarRaster; cmap: (v: number) => string }) {
  return <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${r.width}, 1fr)` }}>{r.values.map((v, i) => <div key={i} className="aspect-square rounded-[1px]" style={{ background: cmap(v) }} title={`${v.toFixed(2)} ${r.unit}`} />)}</div>;
}

export function SarObservatory() {
  const { db } = useStore();
  const [scen, setScen] = useState(SCENARIOS[0]);
  const [thr, setThr] = useState(3);
  const pair = useMemo(() => simulateSarPair(scen.id, { seed: 5, size: 40, extent: [scen.lon - 0.5, scen.lat - 0.4, scen.lon + 0.5, scen.lat + 0.4] }), [scen]);
  const change = useMemo(() => backscatterChange(pair.before, pair.after, { thresholdDb: thr }), [pair, thr]);
  const classes = useMemo(() => classifyChange(change.diff), [change]);
  const disp = useMemo(() => {
    const w = 40, h = 40;
    const vals = new Array<number>(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2) / (w / 2); vals[y * w + x] = 2 * Math.PI * Math.exp(-(d * d) * 3); }
    return phaseToDisplacement({ width: w, height: h, extent: pair.after.extent, values: vals, quantity: 'phase-rad', unit: 'rad', label: 'Synthetic wrapped phase' }, 0.24);
  }, [pair]);
  const related = useMemo(() => (db ? relateEvents(scen.lat, scen.lon, 600, db.events.map((e) => ({ type: e.type, title: e.title, lat: e.lat, lon: e.lon, t: e.t }))) : []), [db, scen]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-teal-500/20 via-emerald-700/20 to-slate-900/20 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white"><Icon name="Radio" className="h-5 w-5 text-teal-300" />SAR Earth Observatory</div>
          <p className="mt-0.5 text-xs text-slate-300">See the invisible — radar reveals surface change that optical imagery misses.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{SAR_MISSIONS.map((m) => <span key={m.id} title={m.note} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">{m.id} · {m.band}-band</span>)}</div>
        </div>
        <div className="flex items-center gap-2"><NarrationButton src="/assets/audio/sar-earth-observatory.mp3" label="Listen" /><StatusBadge status="sample" note="interactive demo · SAMPLE rasters" /></div>
      </div>

      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Before / after studio — {scen.region}</div>
          <select aria-label="Study area" className="input !w-auto !py-1" value={scen.id} onChange={(e) => setScen(SCENARIOS.find((s) => s.id === e.target.value)!)}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="mt-1 text-xs text-slate-400">{pair.groundTruth}</div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div><div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Before · σ0 (dB)</div><RasterGrid r={pair.before} cmap={(v) => (v < -20 ? '#1e3a8a' : v < -16 ? '#334155' : '#475569')} /></div>
          <div><div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">After · σ0 (dB)</div><RasterGrid r={pair.after} cmap={(v) => (v < -20 ? '#1e3a8a' : v < -16 ? '#334155' : '#475569')} /></div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">Detection threshold: <b>{thr} dB</b><input type="range" min={2} max={8} value={thr} onChange={(e) => setThr(+e.target.value)} className="flex-1" /></label>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_260px] gap-4">
          <div><div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Change · after − before (dB)</div><RasterGrid r={change.diff} cmap={cmapDb} /></div>
          <div className="text-xs">
            <div className="rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="text-slate-400">Changed cells</div><div className="text-lg font-bold text-white">{change.changedCells} <span className="text-slate-500">({(change.changedPct * 100).toFixed(1)}%)</span></div></div>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="text-slate-400">Est. affected area</div><div className="text-lg font-bold text-white">{change.areaKm2.toFixed(0)} km²</div></div>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="text-slate-400">Clusters</div><div className="text-lg font-bold text-white">{change.clusters}</div></div>
            <div className="mt-2 space-y-1">{classes.map((c) => <div key={c.label} className="rounded-md border border-white/10 p-1.5"><b className="text-teal-200">{c.label}</b><div className="text-slate-400">{c.reasoning}</div></div>)}</div>
            <p className="mt-2 text-[10px] text-slate-500">{change.method}</p>
          </div>
        </div>
      </Glass>

      <div className="grid grid-cols-2 gap-3">
        <Glass className="p-4">
          <div className="flex items-center justify-between"><div className="h-title">InSAR laboratory</div><StatusBadge status="sample" /></div>
          <p className="mt-1 text-[11px] text-slate-400">Synthetic wrapped phase → line-of-sight displacement (λ = 0.24 m, L-band). LOS only — this never claims full 3-D motion.</p>
          <div className="mx-auto mt-2 max-w-[300px]"><RasterGrid r={disp} cmap={cmapDisp} /></div>
          <p className="mt-2 text-[10px] text-slate-500">Blue = movement toward the satellite (subsidence), red = away. Atmospheric delays, orbit error and phase ambiguity are not modelled here.</p>
        </Glass>
        <Glass className="p-4">
          <div className="h-title">Cross-links to live events · {scen.region}</div>
          <p className="mt-1 text-[11px] text-slate-400">Same area, independent data — what did the quake/fire/flood feeds record here?</p>
          {related.length ? (
            <ul className="scroll-thin mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
              {related.slice(0, 20).map((r, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-white/10 p-1.5"><span style={{ color: TYPE_META[r.type]?.color }}>{TYPE_META[r.type]?.label ?? r.type}</span><span className="flex-1 truncate text-slate-200">{r.title}</span><span className="text-slate-500">{Math.round(r.distKm)} km</span></li>)}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">No independent events within 600 km of this area in the current catalogue. That itself is a finding.</p>}
          <p className="mt-2 text-[10px] text-slate-500">Radar change is a physical measurement; the cause needs independent evidence. Cross-linking is how a signal becomes a story.</p>
        </Glass>
      </div>
    </div>
  );
}
