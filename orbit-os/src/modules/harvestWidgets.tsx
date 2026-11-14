import { useEffect, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { ConfidencePill, Glass, Icon, StatusBadge } from '../components/ui';
import { harvestPowerEvidence, loadManifest, loadPowerHarvest, loadSpace, type HarvestManifest, type PowerHarvest, type SpaceHarvest } from '../data/harvest';
import type { EvidencePack } from '../kernel';
import { useStore } from '../state/store';

/** Earth Pulse, 5-year daily view from the collector harvest. */
export function HarvestPulse({ defaultLoc = 'oslo' }: { defaultLoc?: string }) {
  const { openEvidence } = useStore();
  const [h, setH] = useState<PowerHarvest | null>(null);
  const [loc, setLoc] = useState(defaultLoc);
  const [v, setV] = useState('T2M');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadPowerHarvest().then(setH).catch((e) => setErr(String(e.message || e))); }, []);
  if (err) return <Glass className="p-4 text-xs text-slate-400">Harvest not available ({err}). Run <code>npm run data:live</code>.</Glass>;
  if (!h) return <Glass className="p-4 text-xs text-slate-400">Loading harvest…</Glass>;
  const pack: EvidencePack | null = harvestPowerEvidence(h, loc, v);
  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-title">Recent change · 5 years of daily NASA POWER</div>
        <div className="flex gap-2 text-xs">
          <select aria-label="Harvest location" className="input !w-auto !py-1" value={loc} onChange={(e) => setLoc(e.target.value)}>{h.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select aria-label="Harvest variable" className="input !w-auto !py-1" value={v} onChange={(e) => setV(e.target.value)}>{Object.keys(h.units).map((k) => <option key={k} value={k}>{k}</option>)}</select>
        </div>
      </div>
      {pack && (<>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><b className="text-white">{pack.title}</b><StatusBadge status="live" note={h.label} /><ConfidencePill level={pack.confidence.level} /></div>
        <div className="mt-2 grid grid-cols-5 gap-2">{pack.metrics.map((m, i) => <div key={i} className="rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="truncate text-[10px] text-slate-400">{m.label}</div><div className="text-[13px] font-semibold text-white">{m.value}</div></div>)}</div>
        <LineChart points={pack.series!.points} unit={pack.series!.unit} height={150} color="#34d399" xLabel={(x) => String(Math.floor(x))} />
        <button className="btn-ghost !py-1.5 text-xs" onClick={() => openEvidence(pack)}><Icon name="ShieldCheck" />Evidence pack</button>
      </>)}
    </Glass>
  );
}

/** Space weather + orbital context (SWPC, DONKI, Celestrak), all from the harvest. */
export function SpaceWeather({ compact = false }: { compact?: boolean }) {
  const { openEvidence } = useStore();
  const [s, setS] = useState<SpaceHarvest | null>(null);
  useEffect(() => { loadSpace().then(setS).catch(() => {}); }, []);
  if (!s) return <Glass className="p-4 text-xs text-slate-400">Space-weather harvest not available.</Glass>;
  const kp = s.swpc.kp3h.map(([, k], i) => ({ x: i, y: k }));
  const maxKp = Math.max(...s.swpc.kp3h.map(([, k]) => k));
  const lastWind = [...s.swpc.wind].reverse().find((w) => w[1] !== null);
  const lastImf = [...s.swpc.imf].reverse().find((w) => w[1] !== null);
  const fastest = [...s.donki.cmes].sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0))[0];
  const alt = s.celestrak.sample.map((x) => x.alt_km ?? 0);
  const bands = { LEO: alt.filter((a) => a < 2000).length, MEO: alt.filter((a) => a >= 2000 && a < 35000).length, GEO: alt.filter((a) => a >= 35000).length };
  const pack: EvidencePack = {
    id: 'harvest:kp', title: 'Geomagnetic activity · planetary Kp (7 days)', kind: 'anomaly', status: 'live', statusLabel: s.label,
    sources: [{ name: 'NOAA SWPC planetary K-index', url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', retrieved: s.swpc.retrieved_at }, { name: 'NASA DONKI CME catalogue', url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/', retrieved: s.donki.retrieved_at }],
    window: { start: s.swpc.kp3h[0]?.[0] ?? '—', end: s.swpc.kp3h[s.swpc.kp3h.length - 1]?.[0] ?? '—', label: '3-hour Kp, UTC' },
    confidence: { level: 'high', score: 0.85, rationale: 'Official NOAA product. Kp ≥ 5 is a G1+ geomagnetic storm (NOAA scale).' },
    method: 'Max of 3-hour Kp in the window; storm threshold Kp ≥ 5. CME speeds from DONKI.',
    metrics: [
      { label: 'Max Kp (7 d)', value: `${maxKp}${maxKp >= 5 ? ' (storm level)' : ''}`, status: 'live' },
      { label: 'Latest est. Kp', value: s.swpc.kp_latest_est ? `${s.swpc.kp_latest_est[1]} @ ${s.swpc.kp_latest_est[0].slice(5, 16).replace('T', ' ')} UTC` : '—', status: 'live' },
      { label: 'Solar wind speed', value: lastWind ? `${Math.round(lastWind[1]!)} km/s` : '—', status: 'live' },
      { label: 'IMF Bz (GSM)', value: lastImf ? `${lastImf[1]} nT` : '—', status: 'live' },
      { label: 'CMEs (30 d)', value: String(s.donki.cmes.length), status: 'live' },
      { label: 'Fastest CME', value: fastest ? `${fastest.speed} km/s · ${fastest.time.slice(0, 10)}` : '—', status: 'live' },
    ],
    series: { label: 'Planetary Kp (3-hour)', unit: 'Kp', points: kp },
    records: s.donki.cmes.slice(-12).reverse().map((c) => ({ id: c.id, title: `CME ${c.type ?? ''} · half-angle ${c.half_angle ?? '?'}°`, time: c.time.replace('T', ' ').replace('Z', ' UTC'), value: c.speed ? `${c.speed} km/s` : undefined, url: c.url })),
    limitations: [`${s.label}.`, ...s.donki.errors.map((e) => `DONKI: ${e.split(':')[0]}; no flares are shown.`), 'Context for GNSS/HF/satellite operators, not an official alert.'],
    patterns: ['anomaly', 'fusion', 'review'], createdAt: new Date().toISOString(),
  };
  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between"><div className="h-title">Space weather & orbit</div><StatusBadge status="live" note={s.label} /></div>
      <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-6'}`}>{pack.metrics.map((m, i) => <div key={i} className="rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="truncate text-[10px] text-slate-400">{m.label}</div><div className="text-[12px] font-semibold text-white">{m.value}</div></div>)}</div>
      <LineChart points={kp} unit="Kp" bars height={120} color="#a78bfa" xLabel={(x) => (s.swpc.kp3h[x]?.[0] ?? '').slice(5, 10)} />
      {!compact && <p className="text-[11px] text-slate-400">Celestrak: {s.celestrak.catalog_count?.toLocaleString('en-US') ?? '?'} active objects in the catalogue; sample of {s.celestrak.sample.length} → LEO {bands.LEO} · MEO {bands.MEO} · GEO {bands.GEO} (altitude from mean motion).</p>}
      <button className="btn-ghost mt-2 !py-1.5 text-xs" onClick={() => openEvidence(pack)}><Icon name="ShieldCheck" />Evidence pack</button>
    </Glass>
  );
}

export function HarvestManifestTable() {
  const [m, setM] = useState<HarvestManifest | null>(null);
  useEffect(() => { loadManifest().then(setM).catch(() => {}); }, []);
  if (!m) return <Glass className="mt-3 p-4 text-xs text-slate-400">No collector harvest found in public/data/live (run <code>npm run data:live</code>).</Glass>;
  return (
    <Glass className="mt-3 overflow-hidden p-0">
      <div className="flex items-center justify-between px-3 py-2"><div className="h-title">Data collector harvest · {m.collector} v{m.version}</div><StatusBadge status="live" note={m.display_label} /></div>
      <table className="w-full text-xs"><thead className="bg-white/5 text-left text-slate-400"><tr><th className="p-2">Source</th><th>Status</th><th>Records</th><th>Time range (UTC)</th><th>Notes / errors</th></tr></thead>
        <tbody>{m.sources.map((s) => <tr key={s.id} className="border-t border-white/5 align-top"><td className="p-2 font-medium text-white">{s.id}</td><td className={s.status === 'ok' ? 'text-emerald-300' : 'text-amber-300'}>{s.status}</td><td>{s.record_count.toLocaleString('en-US')}</td><td className="whitespace-nowrap text-slate-400">{s.time_range.start?.slice(0, 16) ?? '—'} → {s.time_range.end?.slice(0, 16) ?? '—'}</td><td className="pr-2 text-slate-400">{[...s.errors.map((e) => `⚠ ${e.slice(0, 120)}`), ...(s.notes ?? []).slice(0, 2)].join(' · ')}</td></tr>)}</tbody></table>
    </Glass>
  );
}
