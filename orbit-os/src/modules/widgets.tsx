import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart } from '../components/LineChart';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { eventEvidence, flagEvidence, isoDay, nearestPlaceName, TYPE_META } from '../data/events';
import { eonetEvents } from '../data/live';
import { PLACES, loadPowerSnapshot } from '../data/power';
import { allocate, analogScore, fuse, haversineKm, poissonForecast, routePlan, WORLDS, zScoreOutliers, type EvidencePack, type SeriesPoint } from '../kernel';
import { useStore } from '../state/store';
import { EarthPulse } from './EarthPulse';
import { rng } from './rng';
import { useEffect } from 'react';

const SampleNote = ({ children }: { children: React.ReactNode }) => <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200"><StatusBadge status="sample" /><span>{children}</span></div>;

const samplePack = (p: Partial<EvidencePack> & { id: string; title: string }): EvidencePack => ({ kind: 'investigation', status: 'sample', sources: [{ name: 'ORBIT synthetic generator (seeded, reproducible)' }], window: { start: 'synthetic', end: 'synthetic' }, confidence: { level: 'low', score: 0.3, rationale: 'Synthetic data demonstrates the method only.' }, method: '', metrics: [], limitations: ['SAMPLE data: illustrates the kernel method, not a real observation.'], patterns: ['anomaly', 'review'], createdAt: new Date().toISOString(), ...p });

/* ---------------- Disaster Watch ---------------- */
export function DisasterWidget() {
  const { db, openEvidence, reviews } = useStore();
  const [type, setType] = useState<string>('all');
  const [live, setLive] = useState<string | null>(null);
  if (!db) return <Glass className="p-4 text-sm text-slate-400">Loading snapshot…</Glass>;
  const flags = db.flags.filter((f) => type === 'all' || f.type === type);
  const DAY = 86400000;
  const pts: SeriesPoint[] = Array.from({ length: 30 }, (_, i) => { const end = db.refTime - (29 - i) * DAY; return { x: i - 29, y: db.events.filter((e) => (type === 'all' || e.type === type) && e.t <= end && e.t > end - DAY).length }; });
  const big = db.events.filter((e) => e.type === 'earthquake' && (e.mag ?? 0) >= 5.5).slice(0, 8);
  const pf = poissonForecast(pts.map((p) => p.y as number), { horizon: 7, window: 14 });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Glass className="col-span-2 p-4">
        <div className="flex items-center justify-between"><div className="h-title">Anomaly fabric · DG-04 flags ({flags.length})</div>
          <div className="flex gap-1">{['all', ...Object.keys(TYPE_META)].map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-full px-2 py-0.5 text-[11px] ${type === t ? 'bg-sky-500/30 text-white' : 'text-slate-400 hover:bg-white/5'}`}>{t === 'all' ? 'All' : TYPE_META[t].label}</button>)}</div></div>
        <div className="mt-1 text-[11px] text-slate-400">{db.label} · last 7 days vs previous 7 days per 2° cell · statistical alert, not a forecast</div>
        <div className="scroll-thin mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-xs"><thead className="sticky top-0 bg-slate-900 text-left text-slate-400"><tr><th className="p-2">Type</th><th>Near</th><th>Prev 7 d</th><th>Last 7 d</th><th>p</th><th>Review</th><th /></tr></thead>
            <tbody>{flags.slice(0, 40).map((f) => (
              <tr key={f.key} onClick={() => openEvidence(flagEvidence(db, f))} className="cursor-pointer border-t border-white/5 hover:bg-sky-500/10">
                <td className="p-2"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TYPE_META[f.type]?.color }} />{TYPE_META[f.type]?.label}</td>
                <td className="text-slate-200">{nearestPlaceName(db, f.lat, f.lon, f.type)}</td><td>{f.previous}</td><td className="font-semibold text-white">{f.current}</td><td>{f.p.toExponential(0)}</td><td className="text-slate-400">{reviews[`flag:${f.key}`]?.state ?? 'pending'}</td><td className="pr-2 text-right text-sky-300">evidence →</td>
              </tr>))}
              {!flags.length && <tr><td colSpan={7} className="p-3 text-slate-500">No cell meets the rule for this type.</td></tr>}</tbody></table>
        </div>
      </Glass>
      <Glass className="p-4"><div className="flex items-center justify-between"><div className="h-title">Daily records, last 30 days</div>{db && <StatusBadge status={db.status} note={db.label} />}</div><LineChart points={pts} unit="records/day" bars color="#f97316" xLabel={(x) => (x === 0 ? isoDay(db.refTime) : `${x} d`)} />{pf.ok && <p className={`mt-1 text-[11px] ${pf.alert ? 'text-amber-300' : 'text-slate-500'}`}>Rate forecast (7 d): λ≈{pf.lambda.toFixed(1)}/day · 95% upper {pf.upper.toFixed(1)} · {pf.alert ? 'recent burst above expected — review' : 'within expected'}</p>}</Glass>
      <Glass className="p-4">
        <div className="flex items-center justify-between"><div className="h-title">M5.5+ earthquakes</div>{db && <StatusBadge status={db.status} note={db.label} />}</div>
        <ul className="mt-2 space-y-1 text-xs">{big.map((e) => <li key={e.id}><button onClick={() => openEvidence(eventEvidence(db, e))} className="text-left text-slate-200 hover:text-sky-300">{e.title} <span className="text-slate-500">· {isoDay(e.t)}</span></button></li>)}</ul>
        <button className="btn-ghost mt-3 !py-1.5 text-xs" onClick={() => { setLive('…'); eonetEvents({ days: 7 }).then((r) => setLive(`${r.events.length} open EONET events in the last 7 days (live ${new Date().toISOString().slice(11, 16)} UTC)`)).catch((e) => setLive(`Live check failed: ${e.message}`)); }}><Icon name="Radio" />Live EONET cross-check</button>
        {live && <p className="mt-2 text-xs text-emerald-300">{live}</p>}
      </Glass>
    </div>
  );
}

/* ---------------- Agri ---------------- */
export function AgriWidget() {
  const [budget, setBudget] = useState(60);
  const fields = useMemo(() => { const r = rng(6); return ['North plot', 'River bend', 'Hill terrace', 'East flats', 'Orchard', 'Seed trial', 'South dry'].map((n, i) => ({ id: `f${i}`, name: n, cost: 6 + Math.round(r() * 18), value: Math.round(10 + r() * 40) })); }, []);
  const plan = allocate(fields, budget);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-3">
      <EarthPulse defaultPlace="sahel" defaultVar="GWETROOT" vars={['GWETROOT', 'PRECTOTCORR', 'T2M']} title="Crop-stress drivers (POWER; SMAP proxy)" />
      <Glass className="p-4">
        <div className="h-title">Water-budget rotation planner</div>
        <SampleNote>Fields, water costs and yield values are synthetic (challenge 6 prototype logic).</SampleNote>
        <label className="text-xs text-slate-300">Irrigation budget: <b>{budget}</b> units<input type="range" min={10} max={120} value={budget} onChange={(e) => setBudget(+e.target.value)} className="w-full" /></label>
        <ul className="mt-2 space-y-1 text-xs">{fields.map((f) => { const on = plan.chosen.some((c) => c.id === f.id); return <li key={f.id} className={`flex justify-between rounded-md px-2 py-1 ${on ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400'}`}><span>{on ? '✓' : '·'} {f.name}</span><span>water {f.cost} · value {f.value}</span></li>; })}</ul>
        <p className="mt-2 text-[11px] text-slate-400">{plan.method}: used {plan.used}/{budget}, value {plan.value}. Kernel: scarce-resource planning.</p>
      </Glass>
    </div>
  );
}

/* ---------------- Ocean ---------------- */
export function OceanWidget() {
  const { db, openEvidence } = useStore();
  const ice = db?.events.filter((e) => e.type === 'seaLakeIce') ?? [];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-3">
      <EarthPulse defaultPlace="atlantic" defaultVar="T2M" vars={['T2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN']} title="Marine air temperature (not SST)" />
      <Glass className="p-4">
        <div className="flex items-center justify-between"><div className="h-title">Icebergs tracked ({ice.length})</div>{db && <StatusBadge status={db.status} note={db.label} />}</div>
        <ul className="scroll-thin mt-2 max-h-72 space-y-1 overflow-y-auto text-xs">{ice.map((e) => <li key={e.id}><button className="text-left text-slate-200 hover:text-sky-300" onClick={() => db && openEvidence(eventEvidence(db, e))}>{e.title} <span className="text-slate-500">{e.mag ?? ''} {e.unit ?? ''} · {isoDay(e.t)}</span></button></li>)}</ul>
        <p className="mt-2 text-[11px] text-slate-500">Source: NASA EONET / US National Ice Center. Ocean colour (PACE, MODIS-Aqua) and SST (GHRSST) are planned connectors.</p>
      </Glass>
    </div>
  );
}

/* ---------------- Infrastructure ---------------- */
export function InfraWidget() {
  const { db, openEvidence } = useStore();
  const N = 16;
  const grid = useMemo(() => { const r = rng(5); return Array.from({ length: N * N }, (_, i) => { const x = i % N, y = Math.floor(i / N); const bowl = Math.exp(-((x - 10) ** 2 + (y - 5) ** 2) / 10) * -28; return +(bowl + (r() - 0.5) * 6).toFixed(1); }); }, []);
  const outl = zScoreOutliers(grid.map((y, x) => ({ x, y })), 2).length;
  const cities = ['tokyo', 'losangeles', 'jakarta', 'alaska', 'iceland'].map((id) => PLACES.find((p) => p.id === id)!);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Glass className="p-4">
        <div className="h-title">Radar surface change (challenge 5)</div>
        <SampleNote>Synthetic line-of-sight displacement grid (mm). NISAR / Sentinel-1 InSAR is not connected.</SampleNote>
        <div className="mx-auto grid max-w-[340px] gap-[2px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>{grid.map((v, i) => <div key={i} title={`${v} mm`} className="aspect-square rounded-[2px]" style={{ background: v < -12 ? '#ef4444' : v < -6 ? '#f97316' : v < -2 ? '#facc15' : '#1e3a8a' }} />)}</div>
        <p className="mt-2 text-xs text-slate-400">Change engine flags {outl} cells at |z|≥2 → sent to human review.</p>
        <button className="btn-ghost mt-2 !py-1.5 text-xs" onClick={() => openEvidence(samplePack({ id: 'sample:insar', title: 'Subsidence bowl (sample grid)', kind: 'anomaly', method: 'Per-pixel z-score on displacement; |z|≥2 flagged.', metrics: [{ label: 'Flagged cells', value: String(outl), status: 'sample' }, { label: 'Min displacement', value: `${Math.min(...grid)} mm`, status: 'sample' }], patterns: ['change', 'anomaly', 'review'] }))}>Evidence pack</button>
      </Glass>
      <Glass className="p-4">
        <div className="flex items-center justify-between"><div className="h-title">Seismic exposure near cities (≤300 km)</div>{db && <StatusBadge status={db.status} note={db.label} />}</div>
        <table className="mt-2 w-full text-xs"><tbody>{cities.map((c) => { const ev = db?.events.filter((e) => e.type === 'earthquake' && haversineKm(c.lat, c.lon, e.lat, e.lon) <= 300) ?? []; const mx = ev.reduce((m, e) => Math.max(m, e.mag ?? 0), 0); return (
          <tr key={c.id} className="border-b border-white/5"><td className="py-1.5 text-slate-200">{c.name}</td><td>{ev.length} quakes</td><td>max M{mx.toFixed(1)}</td><td className="text-right">{ev[0] && db && <button className="text-sky-300" onClick={() => openEvidence(eventEvidence(db, ev.reduce((a, b) => ((b.mag ?? 0) > (a.mag ?? 0) ? b : a))))}>largest →</button>}</td></tr>); })}</tbody></table>
        <p className="mt-2 text-[11px] text-slate-500">USGS, 30-day window of the active source. Exposure ≠ risk; no structural assessment is implied.</p>
      </Glass>
    </div>
  );
}

/* ---------------- GNSS ---------------- */
export function GnssWidget() {
  const { openEvidence } = useStore();
  const data = useMemo(() => { const r = rng(42); return Array.from({ length: 120 }, (_, i) => ({ x: i, y: +(44 + (r() - 0.5) * 2 - (i > 70 && i < 88 ? 14 + r() * 4 : 0)).toFixed(1) })); }, []);
  const out = zScoreOutliers(data, 2);
  const f = fuse([{ name: 'C/N0 drop', signal: 0.9, quality: 0.8, status: 'sample' }, { name: 'AGC rise', signal: 0.7, quality: 0.7, status: 'sample' }, { name: 'Position jump', signal: 0.2, quality: 0.5, status: 'sample' }]);
  return (
    <Glass className="p-4">
      <div className="h-title">Interference intent detection</div>
      <SampleNote>Synthetic carrier-to-noise (C/N0) trace with an injected jamming episode. No GNSS receiver feed is connected; Arctic Intel Watch is the planned integration.</SampleNote>
      <LineChart points={data} unit="dB-Hz" color="#a78bfa" xLabel={(x) => `${x} s`} />
      <p className="text-xs text-slate-300">Anomaly kernel: {out.length} samples at |z|≥2 (t={out[0]?.x}–{out[out.length - 1]?.x} s). Fusion of 3 indicators → support {f.support.toFixed(2)}, agreement {Math.round(f.agreement * 100)}%, <b>{f.level}</b> confidence (sample down-weighted).</p>
      <button className="btn-ghost mt-2 !py-1.5 text-xs" onClick={() => openEvidence(samplePack({ id: 'sample:gnss', title: 'Probable jamming episode (sample)', kind: 'fusion', method: 'z-score on C/N0 + quality-weighted fusion with AGC and position residuals.', metrics: [{ label: 'Flagged samples', value: String(out.length), status: 'sample' }, { label: 'Fusion confidence', value: `${Math.round(f.confidence * 100)}/100`, status: 'sample' }], series: { label: 'C/N0', unit: 'dB-Hz', points: data }, patterns: ['anomaly', 'fusion', 'review'] }))}>Evidence pack</button>
    </Glass>
  );
}

/* ---------------- Autonomy ---------------- */
export function AutonomyWidget() {
  const [world, setWorld] = useState<'svalbard' | 'mars'>('mars');
  const N = 22;
  const cost = useMemo(() => { const r = rng(world === 'mars' ? 10 : 77); return Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => { const ridge = Math.abs(x - 11 - Math.sin(y / 3) * 3) < 1.2 && y > 3 && y < 19 ? Infinity : 1 + r() * (world === 'mars' ? 4 : 2.5); return ridge; })); }, [world]);
  const { path, energy } = routePlan(cost, [2, 2], [N - 3, N - 3]);
  const on = new Set(path.map(([r, c]) => r * N + c));
  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between"><div className="h-title">Energy-limited route planner (challenge 10)</div>
        <div className="flex gap-1 text-xs">{(['svalbard', 'mars'] as const).map((w) => <button key={w} onClick={() => setWorld(w)} className={`rounded-full px-2 py-0.5 ${world === w ? 'bg-fuchsia-500/30 text-white' : 'text-slate-400'}`}>{w === 'mars' ? 'Mars rover' : 'Svalbard drone (Earth analog)'}</button>)}</div></div>
      <SampleNote>Synthetic terrain-cost grids. Same A* kernel on Earth and Mars: that is the transfer pattern.</SampleNote>
      <div className="mx-auto grid max-w-[380px] gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>{cost.flat().map((c, i) => <div key={i} className="aspect-square" style={{ background: on.has(i) ? '#e879f9' : !Number.isFinite(c) ? '#111827' : world === 'mars' ? `rgba(234,88,12,${0.2 + c / 8})` : `rgba(148,163,184,${0.15 + c / 6})` }} />)}</div>
      <p className="mt-2 text-xs text-slate-300">Path {path.length} cells · energy cost {energy.toFixed(1)} units (sample).</p>
    </Glass>
  );
}

/* ---------------- Space Explorer ---------------- */
export function ExplorerWidget() {
  const [rows, setRows] = useState<{ name: string; mars: number; moon: number; t: number; p: number }[]>([]);
  const nav = useNavigate();
  useEffect(() => { loadPowerSnapshot().then((s) => {
    const ids = ['atacama', 'dryvalleys', 'deathvalley', 'iceland', 'svalbard', 'sahel', 'greenland', 'nile', 'andoya'];
    setRows(ids.map((id) => { const par = s.places[id].parameter; const avg = (k: string) => { const v = Object.entries(par[k]).filter(([d, x]) => d.endsWith('13') && x > -900).map(([, x]) => x); return v.reduce((a, b) => a + b, 0) / v.length; }; const site = { tempC: avg('T2M'), precipMmDay: avg('PRECTOTCORR'), solarMJ: avg('ALLSKY_SFC_SW_DWN') }; return { name: PLACES.find((p) => p.id === id)!.name, mars: analogScore(site, WORLDS[0]).score, moon: analogScore(site, WORLDS[1]).score, t: site.tempC, p: site.precipMmDay }; }).sort((a, b) => b.mars - a.mars));
  }); }, []);
  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between"><div className="h-title">Earth analog → Moon / Mars transfer (challenges 9, 11)</div><button className="btn-ghost !py-1 text-xs" onClick={() => nav('/analysis?q=Which%20Earth%20site%20is%20the%20best%20Mars%20analog%3F')}>Run as investigation →</button></div>
      <p className="mt-1 text-[11px] text-slate-400">Earth columns: <StatusBadge status="snapshot" /> NASA POWER 2001–2025 means. Scores: <StatusBadge status="sample" /> because Mars/Moon profiles are approximate reference values.</p>
      <table className="mt-2 w-full text-xs"><thead className="text-left text-slate-400"><tr><th className="py-1">Earth site</th><th>Mean T (°C)</th><th>Precip (mm/d)</th><th>Mars score</th><th>Moon score</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.name} className="border-t border-white/5"><td className="py-1.5 text-slate-200">{r.name}</td><td>{r.t.toFixed(1)}</td><td>{r.p.toFixed(2)}</td><td><Bar v={r.mars} c="#f97316" /></td><td><Bar v={r.moon} c="#cbd5e1" /></td></tr>)}</tbody></table>
      <p className="mt-2 text-[11px] text-slate-500">Mission pattern: validate the change engine at the top Earth analog with real data, then run the same pipeline on lunar/Martian imagery (LRO, MRO). Off-world data connectors are planned.</p>
    </Glass>
  );
}
const Bar = ({ v, c }: { v: number; c: string }) => <div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${Math.round(v * 100)}%`, background: c }} /></div><span>{Math.round(v * 100)}</span></div>;

/* ---------------- Mission Academy ---------------- */
export function AcademyWidget() {
  const [mass, setMass] = useState(1000);
  const items = [
    { id: 'hab', name: 'Inflatable habitat', cost: 420, value: 90 }, { id: 'solar', name: 'Solar array 10 kW', cost: 180, value: 70 }, { id: 'isru', name: 'ISRU water extractor', cost: 350, value: 85 },
    { id: 'rover', name: 'Pressurised rover', cost: 520, value: 60 }, { id: 'comms', name: 'Relay comms', cost: 90, value: 55 }, { id: 'sci', name: 'Science drill', cost: 160, value: 50 },
    { id: 'med', name: 'Medical bay', cost: 140, value: 45 }, { id: 'green', name: 'Greenhouse module', cost: 260, value: 40 },
  ];
  const plan = allocate(items.map((i) => ({ ...i, cost: Math.round(i.cost / 10) })), Math.round(mass / 10));
  return (
    <Glass className="p-4">
      <div className="h-title">Mars outpost designer (challenges 13, 3)</div>
      <SampleNote>Educational masses and value scores, not engineering data.</SampleNote>
      <label className="text-xs text-slate-300">Landed mass budget: <b>{mass} kg</b><input type="range" min={300} max={2500} step={50} value={mass} onChange={(e) => setMass(+e.target.value)} className="w-full" /></label>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">{items.map((i) => { const on = plan.chosen.some((c) => c.id === i.id); return <div key={i.id} className={`rounded-lg border p-2 ${on ? 'border-amber-400/40 bg-amber-500/10 text-amber-100' : 'border-white/10 text-slate-400'}`}>{on ? '✓ ' : ''}{i.name}<div className="text-[10px] opacity-80">{i.cost} kg · value {i.value}</div></div>; })}</div>
      <p className="mt-2 text-[11px] text-slate-400">{plan.method}: {plan.used * 10} kg used, mission value {plan.value}.</p>
    </Glass>
  );
}

/* ---------------- Human Space Lab ---------------- */
export function HumanWidget() {
  const hr = useMemo(() => { const r = rng(4); return Array.from({ length: 96 }, (_, i) => ({ x: i, y: +(62 + 8 * Math.sin(i / 15) + (r() - 0.5) * 4 + (i === 57 || i === 58 ? 22 : 0)).toFixed(0) })); }, []);
  const out = zScoreOutliers(hr, 2.5);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Glass className="p-4">
        <div className="h-title">Crew heart-rate anomaly review (challenge 4)</div>
        <SampleNote>Synthetic trace. Concept only. No medical or flight-safety claims.</SampleNote>
        <LineChart points={hr} unit="bpm" color="#f472b6" xLabel={(x) => `${Math.round(x / 4)} h`} />
        <p className="text-xs text-slate-300">{out.length} readings at |z|≥2.5 queued for a flight surgeon's review. The kernel never diagnoses.</p>
      </Glass>
      <Glass className="p-4">
        <div className="h-title">ISS microgravity combustion (challenge 7)</div>
        <div className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/5 p-3 text-xs text-rose-100"><b>Kept separate by design.</b> Flame behaviour in microgravity (spherical flames, diffusion-limited burning) is a different physical regime from Earth wildfires. ORBIT does not merge challenge 7 data with FIRMS/EONET fire data, and no Earth fire metric is derived from it.</div>
        <p className="mt-2 text-[11px] text-slate-400">Shared kernel use is limited to the review workflow and series anomaly detection on experiment telemetry (sample, in the embedded prototype).</p>
      </Glass>
    </div>
  );
}
