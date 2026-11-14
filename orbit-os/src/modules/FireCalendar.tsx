import { useEffect, useMemo, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { loadEvents, type OrbitEvent } from '../data/events';
import { firmsCellEvidence, loadFirms, type FirmsGrid } from '../data/harvest';
import type { SeriesPoint } from '../kernel';
import { useStore } from '../state/store';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** FIRMS sensor codes -> family + display name. Terra (T) and Aqua (A) are MODIS; N20/N21 are VIIRS. */
const SENSOR_NAME: Record<string, string> = {
  T: 'Terra (MODIS)', A: 'Aqua (MODIS)', N20: 'NOAA-20 (VIIRS)', N21: 'NOAA-21 (VIIRS)',
  NPP: 'Suomi-NPP (VIIRS)', V: 'VIIRS (other)',
};

const fireBg = (count: number, max: number) => {
  const f = max <= 0 ? 0 : count / max;
  // dark slate -> orange -> red as intensity rises
  return f === 0 ? 'rgba(30,41,59,0.35)' : `rgba(249,115,22,${(0.2 + 0.8 * f).toFixed(2)})`;
};

/**
 * Fire Calendar Harmonizer (challenge #8). Harmonizes MODIS + VIIRS active-fire
 * detections (FIRMS 1° cells) with the EONET wildfire incident calendar, all from
 * the live collector harvest. Never a forecast, never an official alert.
 */
export function FireCalendar() {
  const { openEvidence } = useStore();
  const [grid, setGrid] = useState<FirmsGrid | null>(null);
  const [wildfires, setWildfires] = useState<OrbitEvent[] | null>(null);
  const [eventsLabel, setEventsLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadFirms(), loadEvents('harvest')])
      .then(([g, db]) => {
        if (!alive) return;
        setGrid(g);
        setWildfires(db.events.filter((e) => e.type === 'wildfires'));
        setEventsLabel(db.label);
      })
      .catch((e) => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, []);

  const sat = useMemo(() => {
    if (!grid) return null;
    const b = grid.by_satellite ?? {};
    const modis = { T: b.T ?? 0, A: b.A ?? 0 };
    const viirs = { N20: b.N20 ?? 0, N21: b.N21 ?? 0, NPP: b.NPP ?? 0, V: b.V ?? 0 };
    const modisTotal = modis.T + modis.A;
    const viirsTotal = viirs.N20 + viirs.N21 + viirs.NPP + viirs.V;
    return { modis, viirs, modisTotal, viirsTotal, total: modisTotal + viirsTotal };
  }, [grid]);

  const monthly = useMemo(() => {
    if (!wildfires) return null;
    const map = new Map<string, number>();
    for (const e of wildfires) {
      const d = new Date(e.t);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const keys = [...map.keys()].sort();
    const points: SeriesPoint[] = keys.map((k, i) => ({ x: i, y: map.get(k)! }));
    const years = [...new Set(keys.map((k) => +k.slice(0, 4)))].sort();
    const max = Math.max(...map.values());
    const first = wildfires.reduce((m, e) => Math.min(m, e.t), Infinity);
    const last = wildfires.reduce((m, e) => Math.max(m, e.t), -Infinity);
    return { keys, points, years, max, map, first, last };
  }, [wildfires]);

  const topCells = useMemo(() => {
    if (!grid) return [];
    return grid.cells.slice().sort((a, b) => b[3] - a[3]).slice(0, 10);
  }, [grid]);

  if (err) return <Glass className="p-4 text-sm text-rose-300">Live harvest unavailable ({err}). Run <code>npm run data:live</code> and reload.</Glass>;
  if (!grid || !wildfires || !sat || !monthly) return <Glass className="p-4 text-sm text-slate-400">Loading live harvest (NASA FIRMS + EONET)…</Glass>;

  const modisPct = sat.total ? (sat.modisTotal / sat.total) * 100 : 0;
  const viirsPct = sat.total ? (sat.viirsTotal / sat.total) * 100 : 0;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <PageHeader
        icon="Flame"
        title="Fire Calendar Harmonizer"
        subtitle="One harmonized MODIS + VIIRS active-fire view, calendarized against EONET wildfire incidents."
        right={<div className="flex flex-col items-end gap-1"><StatusBadge status="live" note={grid.label} /><StatusBadge status="live" note={eventsLabel} /></div>}
      />

      {/* (a) satellite comparison */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Satellite comparison · detections in the 24 h window</div>
          <Chip className="border-emerald-400/30 text-emerald-200">live (harvest)</Chip>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {grid.detections.toLocaleString('en-US')} total detections · {grid.time_range.start.slice(0, 16).replace('T', ' ')} → {grid.time_range.end.slice(0, 16).replace('T', ' ')} UTC · {grid.cell_deg}° cells
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {([
            { name: 'MODIS', sub: 'Terra + Aqua', n: sat.modisTotal, pct: modisPct, color: '#38bdf8', icon: 'Satellite' },
            { name: 'VIIRS', sub: 'NOAA-20 + NOAA-21', n: sat.viirsTotal, pct: viirsPct, color: '#f97316', icon: 'Satellite' },
          ] as const).map((s) => (
            <div key={s.name} className="rounded-lg border border-white/10 bg-white/[.03] p-3">
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-semibold text-white"><Icon name={s.icon} className="h-4 w-4" style={{ color: s.color }} />{s.name}</span><span className="text-slate-400">{s.pct.toFixed(1)}%</span></div>
              <div className="mt-1 text-2xl font-bold text-white">{s.n.toLocaleString('en-US')}</div>
              <div className="text-[10px] text-slate-400">{s.sub}</div>
              <div className="mt-2 h-1.5 w-full rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${s.pct.toFixed(1)}%`, background: s.color }} /></div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['T', 'A', 'N20', 'N21'] as const).map((k) => {
            const n = k === 'T' ? sat.modis.T : k === 'A' ? sat.modis.A : k === 'N20' ? sat.viirs.N20 : sat.viirs.N21;
            return (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[.03] p-2">
                <div className="truncate text-[10px] text-slate-400">{SENSOR_NAME[k]}</div>
                <div className="text-[15px] font-semibold text-white">{n.toLocaleString('en-US')}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Raw counts are not a fair fight — VIIRS resolves more, smaller detections. See <b className="text-slate-300">Why harmonization matters</b> below.</p>
      </Glass>

      {/* (b) monthly calendar / histogram */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Glass className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-title">Monthly EONET wildfire incidents (histogram)</div>
            <StatusBadge status="live" note={eventsLabel} />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {wildfires.length.toLocaleString('en-US')} wildfire events · {iso(monthly.first)} → {iso(monthly.last)}
          </div>
          <LineChart points={monthly.points} unit="events/mo" bars height={170} color="#f97316" xLabel={(x) => monthly.keys[Math.round(x)] ?? ''} />
          <p className="mt-1 text-[10px] text-slate-500">EONET rows are incident events (latest geometry date), not satellite detections — a single fire can span months and appear in many rows.</p>
        </Glass>

        <Glass className="p-4">
          <div className="h-title">Fire calendar (year × month heatmap)</div>
          <div className="mt-1 text-[11px] text-slate-400">EONET wildfire events per calendar month · peak month {monthly.max} events</div>
          <div className="mt-2">
            <div className="grid grid-cols-[44px_repeat(12,1fr)] gap-1 text-center text-[9px] uppercase text-slate-500">
              <span />
              {MONTH_LABELS.map((m) => <span key={m}>{m}</span>)}
            </div>
            {monthly.years.map((y) => (
              <div key={y} className="mt-1 grid grid-cols-[44px_repeat(12,1fr)] items-center gap-1">
                <span className="text-right text-[11px] font-semibold text-slate-300">{y}</span>
                {MONTH_LABELS.map((_, mi) => {
                  const key = `${y}-${String(mi + 1).padStart(2, '0')}`;
                  const n = monthly.map.get(key) ?? 0;
                  return (
                    <div key={mi} title={`${key}: ${n} events`} className="grid aspect-[4/3] place-items-center rounded-md text-[10px] font-semibold" style={{ background: fireBg(n, monthly.max), color: n > monthly.max * 0.55 ? '#fff' : '#94a3b8' }}>
                      {n > 0 ? n : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(30,41,59,0.35)' }} /> 0 events · <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(249,115,22,0.25)' }} /> low · <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(249,115,22,0.55)' }} /> mid · <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(249,115,22,1)' }} /> peak</div>
        </Glass>
      </div>

      {/* (c) top active fire cells */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Top active fire cells (24 h) · by total FRP</div>
          <StatusBadge status="live" note={grid.label} />
        </div>
        <div className="mt-1 text-[11px] text-slate-400">1° grid cells from NASA FIRMS NRT (MODIS + VIIRS). Each row opens an evidence pack.</div>
        <div className="scroll-thin mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
              <tr><th className="p-2">Cell</th><th>Detections</th><th>Total FRP</th><th>Max FRP</th><th>Night</th><th /></tr>
            </thead>
            <tbody>
              {topCells.map((c) => (
                <tr key={`${c[0]},${c[1]}`} onClick={() => openEvidence(firmsCellEvidence(grid, c))} className="cursor-pointer border-t border-white/5 hover:bg-sky-500/10">
                  <td className="p-2 font-medium text-white">{c[0].toFixed(1)}°, {c[1].toFixed(1)}°</td>
                  <td>{c[2].toLocaleString('en-US')}</td>
                  <td className="font-semibold text-orange-300">{c[3].toLocaleString('en-US')} MW</td>
                  <td>{c[4].toLocaleString('en-US')} MW</td>
                  <td>{c[5].toLocaleString('en-US')}</td>
                  <td className="pr-2 text-right text-sky-300">evidence →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* why harmonization matters — honest */}
      <Glass className="p-4">
        <div className="h-title">Why harmonization matters</div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
          <li><b className="text-white">Overpass times differ.</b> Terra (MODIS) crosses ~10:30 local, Aqua (MODIS) ~13:30, and NOAA-20/21 (VIIRS) ~13:30. Fire intensity peaks in the afternoon, so afternoon sensors see more detections than the morning Terra pass — that is a timing effect, not more fire.</li>
          <li><b className="text-white">Resolution and sensitivity differ.</b> MODIS thermal bands are ~1 km; VIIRS I-bands are ~375 m and detect smaller, cooler fires. One MODIS pixel can split into several VIIRS detections, so VIIRS counts are structurally higher.</li>
          <li><b className="text-white">Record length differs.</b> MODIS has a ~25-year archive (Terra 2000, Aqua 2002); VIIRS is newer (SNPP 2011, NOAA-20 2017, NOAA-21 2022). Multi-decade trend work needs MODIS; today's fast detection benefits from VIIRS.</li>
          <li><b className="text-white">Counts are not unique fires.</b> Every detection is a per-pixel, per-overpass thermal anomaly; one fire can generate many detections across both sensors, and industrial heat or volcanoes also appear. Harmonizing means correcting for these biases before comparing or trending.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <Chip>MODIS Terra ~10:30 / Aqua ~13:30 local</Chip>
          <Chip>VIIRS NOAA-20/21 ~13:30 local · 375 m</Chip>
          <Chip>SNPP empty this harvest (no data rows)</Chip>
          <Chip className="border-emerald-400/30 text-emerald-300">live (harvest) · not an official alert</Chip>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">{grid.label} · {grid.notes?.[0] ?? ''} {grid.notes?.find((n) => n.startsWith('viirs_snpp')) ? `· ${grid.notes.find((n) => n.startsWith('viirs_snpp'))!}` : ''}</p>
      </Glass>
    </div>
  );
}
