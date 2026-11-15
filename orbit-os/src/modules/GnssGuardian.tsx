import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart } from '../components/LineChart';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { NorwayLive } from './NorwayLive';
import { evaluateDetector, gnssIntegrity, GNSS_SCENARIOS, parseGnssLogger, parseNmea, simulateGnss, type GnssEvaluation, type GnssIntegrity, type GnssMeasurement, type GnssScenario } from '../kernel';

type Tab = 'overview' | 'monitor' | 'integrity' | 'lab' | 'evaluation' | 'evidence';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Mission Overview', icon: 'LayoutDashboard' },
  { id: 'monitor', label: 'Signal Monitor', icon: 'Activity' },
  { id: 'integrity', label: 'Integrity', icon: 'ShieldCheck' },
  { id: 'lab', label: 'Simulation Lab', icon: 'Puzzle' },
  { id: 'evaluation', label: 'Evaluation', icon: 'ChartColumn' },
  { id: 'evidence', label: 'Evidence & Export', icon: 'FileText' },
];

const CLASS_STYLE: Record<string, string> = {
  normal: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  reduced: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  'potential interference': 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  'suspicious inconsistency': 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  'insufficient evidence': 'bg-slate-500/15 text-slate-400 border-slate-400/20',
};
const sev = (s: string) => (s === 'alert' ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : s === 'watch' ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-sky-400/30 bg-sky-500/10 text-sky-200');

export function GnssGuardian() {
  const [measurements, setMeasurements] = useState<GnssMeasurement[]>([]);
  const [source, setSource] = useState('no recording loaded');
  const [status, setStatus] = useState<'sample' | 'live'>('sample');
  const [tab, setTab] = useState<Tab>('overview');
  const [scenario, setScenario] = useState<GnssScenario>(() => simulateGnss('low-signal'));
  const [evalRes, setEvalRes] = useState<GnssEvaluation | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const integrity = useMemo(() => gnssIntegrity(measurements, { source }), [measurements, source]);
  const scenarioInt = useMemo(() => gnssIntegrity(scenario.measurements, { source: `sim:${scenario.id}` }), [scenario]);
  const cls = integrity.ok ? integrity.classification : 'insufficient evidence';
  const score = integrity.ok ? integrity.score : 0;

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const isNmea = /^\s*\$G[PNALB]/m.test(text);
      const res = isNmea ? parseNmea(text, file.name) : parseGnssLogger(text, file.name);
      if (!res.ok) { setParseErr(res.error ?? 'Parse failed.'); return; }
      setParseErr(null);
      setMeasurements(res.measurements);
      setSource(`${file.name} · ${res.measurements.length} measurements`);
      setStatus('live');
      setTab('overview');
    };
    reader.readAsText(file);
  };

  const exportJson = () => {
    const payload = { product: 'ORBIT OS — GNSS Guardian', source, status, generatedAt: new Date().toISOString(), integrity };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'gnss-guardian-report.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-violet-500/20 via-indigo-700/20 to-slate-900/20 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-white"><Icon name="Satellite" className="h-5 w-5 text-violet-300" />GNSS Guardian</div>
          <p className="mt-0.5 text-xs text-slate-300">Know when navigation cannot be trusted.</p>
          {/* real Arctic context leads; the integrity engine needs a recording */}
        <div className="mb-2"><NorwayLive aoiId="longyearbyen" title="Arctic context · Longyearbyen live conditions" compact /></div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={status} note={measurements.length ? 'uploaded recording' : 'no recording loaded'} /><Chip>rule-based · experimental</Chip></div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt,.log,.nmea,.nmea0183" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
          <button className="btn-primary !py-1.5 text-xs" onClick={() => fileRef.current?.click()}><Icon name="Database" />Load GnssLogger / NMEA</button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => { setMeasurements([]); setSource('no recording loaded'); setStatus('live'); setParseErr(null); }}>Clear recording</button>
          <Link to="/arctic" className="btn-ghost !py-1.5 text-xs"><Icon name="Globe2" />Arctic Intel Watch</Link>
        </div>
      </div>
      {parseErr && <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-xs text-rose-200">{parseErr}</div>}

      {/* score strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Glass className="p-3">
          <div className="flex items-center justify-between"><div className="text-[10px] uppercase tracking-wide text-slate-400">Integrity score</div><Icon name="ShieldCheck" className="h-4 w-4 text-violet-300" /></div>
          <div className="mt-1 text-3xl font-bold text-white">{integrity.ok ? score : '—'}<span className="text-sm text-slate-400">/100</span></div>
        </Glass>
        <Glass className="p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Assessment</div>
          <span className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${CLASS_STYLE[cls]}`}>{cls}</span>
        </Glass>
        <Glass className="p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Measurements</div>
          <div className="mt-1 text-xl font-bold text-white">{integrity.n.toLocaleString('en-US')}</div>
          <div className="text-[10px] text-slate-400">{integrity.durationS.toFixed(0)} s · {integrity.constellations.length} constellations</div>
        </Glass>
        <Glass className="p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Baseline C/N0</div>
          <div className="mt-1 text-xl font-bold text-white">{integrity.baselineCn0 !== null ? `${integrity.baselineCn0.toFixed(0)} dB-Hz` : '—'}</div>
          <div className="text-[10px] text-slate-400">{integrity.events.length} signal event(s)</div>
        </Glass>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${tab === t.id ? 'border-violet-400/50 bg-violet-500/15 text-violet-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
            <Icon name={t.icon} className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {integrity.constellations.map((c) => (
            <Glass key={c.id} className="p-3">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{c.id}</span><Chip>{c.count.toLocaleString('en-US')} obs</Chip></div>
              <div className="mt-2 text-xs text-slate-300">mean C/N0 <b className="text-white">{c.meanCn0.toFixed(1)} dB-Hz</b></div>
              <div className="text-xs text-slate-400">σ {c.sdCn0.toFixed(1)} dB-Hz</div>
            </Glass>
          ))}
          {!integrity.constellations.length && <Glass className="p-4 text-xs text-slate-500">No constellation data.</Glass>}
        </div>
      )}

      {tab === 'monitor' && (
        <div className="grid gap-3">
          <Glass className="p-4">
            <div className="h-title">C/N0 over time (all satellites, per bin)</div>
            <LineChart points={integrity.bins.map((b) => ({ x: b.t, y: b.cn0 }))} unit="dB-Hz" height={180} color="#a78bfa" xLabel={(x) => `${x.toFixed(0)}s`} />
          </Glass>
          <div className="grid grid-cols-2 gap-3">
            <Glass className="p-4">
              <div className="h-title">Visible satellites</div>
              <LineChart points={integrity.bins.map((b) => ({ x: b.t, y: b.sats }))} unit="sats" height={140} bars color="#38bdf8" xLabel={(x) => `${x.toFixed(0)}s`} />
            </Glass>
            <Glass className="p-4">
              <div className="h-title">AGC (if present)</div>
              {integrity.bins.some((b) => b.agc !== null)
                ? <LineChart points={integrity.bins.map((b) => ({ x: b.t, y: b.agc }))} unit="dB" height={140} color="#fbbf24" xLabel={(x) => `${x.toFixed(0)}s`} />
                : <p className="mt-2 text-xs text-slate-500">This recording has no AGC column. AGC enables interference discrimination.</p>}
            </Glass>
          </div>
        </div>
      )}

      {tab === 'integrity' && (
        <div className="grid gap-3 md:grid-cols-2">
          <Glass className="p-4">
            <div className="h-title">Integrity factors</div>
            <ul className="mt-2 space-y-2">
              {integrity.factors.map((f) => (
                <li key={f.label} title={f.note} className="rounded-lg border border-white/10 p-2">
                  <div className="flex items-center justify-between text-xs"><span className="text-slate-200">{f.label} <span className="text-slate-500">· weight {f.weight.toFixed(2)}</span></span><b className="text-white">{f.value}</b></div>
                  <div className="mt-1 h-1.5 w-full rounded bg-white/10"><div className="h-1.5 rounded bg-violet-400" style={{ width: `${Math.round(f.weight * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-slate-500">Experimental heuristic — not a certified safety metric.</p>
          </Glass>
          <Glass className="p-4">
            <div className="h-title">Signal events ({integrity.events.length})</div>
            {integrity.events.length
              ? <ul className="scroll-thin mt-2 max-h-80 space-y-1.5 overflow-y-auto">{integrity.events.map((e, i) => (
                  <li key={i} className={`rounded-lg border p-2 text-xs ${sev(e.severity)}`}><span className="font-mono text-[10px] opacity-70">t={e.t.toFixed(0)}s</span> · <b>{e.kind}</b><div className="mt-0.5 text-slate-300">{e.text}</div></li>
                ))}</ul>
              : <p className="mt-2 text-xs text-slate-500">No events detected.</p>}
            <div className="mt-3 border-t border-white/10 pt-2"><div className="h-title">Limitations</div><ul className="mt-1 space-y-1 text-[11px] text-slate-400">{integrity.limitations.map((l, i) => <li key={i}>· {l}</li>)}</ul></div>
          </Glass>
        </div>
      )}

      {tab === 'lab' && (
        <div className="grid gap-3">
          <Glass className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="h-title">Scenario simulation lab</div>
              <select aria-label="Scenario" className="input !w-auto !py-1" value={scenario.id} onChange={(e) => setScenario(simulateGnss(e.target.value))}>
                {GNSS_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-300">{scenario.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Ground truth: <b className="text-white">{scenario.groundTruth}</b></span>
              <span className={`rounded-md border px-2 py-1 ${CLASS_STYLE[scenarioInt.classification]}`}>Detector: <b>{scenarioInt.classification}</b></span>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">Match: <b className={scenario.anomalous === (scenarioInt.classification === 'potential interference' || scenarioInt.classification === 'suspicious inconsistency') ? 'text-emerald-300' : 'text-amber-300'}>{scenario.anomalous === (scenarioInt.classification === 'potential interference' || scenarioInt.classification === 'suspicious inconsistency') ? 'correct' : 'review'}</b></span>
            </div>
            <div className="mt-3"><LineChart points={scenarioInt.bins.map((b) => ({ x: b.t, y: b.cn0 }))} unit="dB-Hz" height={160} color="#a78bfa" xLabel={(x) => `${x.toFixed(0)}s`} /></div>
            <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200"><b>Safe by design:</b> the simulator generates software-only, seeded data in this browser. It never transmits RF, never interferes with real navigation, and provides no path to generate genuine spoofing or jamming signals. Every scenario carries a ground-truth label and a fixed random seed, so the run is reproducible.</p>
          </Glass>
        </div>
      )}

      {tab === 'evaluation' && (
        <Glass className="p-4">
          <div className="flex items-center justify-between">
            <div className="h-title">Scientific evaluation (simulated)</div>
            <button className="btn-primary !py-1.5 text-xs" onClick={() => setEvalRes(evaluateDetector())}><Icon name="Zap" />Run all 8 scenarios</button>
          </div>
          {!evalRes
            ? <p className="mt-2 text-xs text-slate-500">Run the detector across the 8 seeded scenarios to compute precision / recall / F1 against ground truth.</p>
            : (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[['True positives', evalRes.tp, 'text-emerald-300'], ['False positives', evalRes.fp, 'text-amber-300'], ['False negatives', evalRes.fn, 'text-rose-300'], ['True negatives', evalRes.tn, 'text-emerald-300'], ['F1', evalRes.f1.toFixed(2), 'text-white']].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-lg border border-white/10 bg-white/[.03] p-2 text-center"><div className={`text-xl font-bold ${c}`}>{v}</div><div className="text-[10px] text-slate-400">{l}</div></div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded-md border border-white/10 px-2 py-1">Precision <b className="text-white">{evalRes.precision.toFixed(2)}</b></span>
                  <span className="rounded-md border border-white/10 px-2 py-1">Recall <b className="text-white">{evalRes.recall.toFixed(2)}</b></span>
                  <span className="rounded-md border border-white/10 px-2 py-1">F1 <b className="text-white">{evalRes.f1.toFixed(2)}</b></span>
                </div>
                <table className="mt-3 w-full text-xs">
                  <thead className="text-left text-slate-400"><tr><th className="py-1">Scenario</th><th>Ground truth</th><th>Detector</th><th>Result</th></tr></thead>
                  <tbody>{evalRes.scenarios.map((r) => (
                    <tr key={r.id} className="border-t border-white/5"><td className="py-1.5 text-slate-200">{r.name}</td><td>{r.groundTruth}</td><td>{r.classification}</td><td className={r.correct ? 'text-emerald-300' : 'text-amber-300'}>{r.correct ? 'correct' : 'review'}</td></tr>
                  ))}</tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-500">{evalRes.note}</p>
              </div>
            )}
        </Glass>
      )}

      {tab === 'evidence' && (
        <div className="grid gap-3 md:grid-cols-2">
          <Glass className="p-4">
            <div className="h-title">Provenance</div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-slate-400">Source</dt><dd className="text-slate-100">{source}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Data status</dt><dd><StatusBadge status={status} note={measurements.length ? 'uploaded recording' : 'no recording loaded'} /></dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Measurements</dt><dd className="text-slate-100">{integrity.n.toLocaleString('en-US')}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Duration</dt><dd className="text-slate-100">{integrity.durationS.toFixed(0)} s</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Assessment</dt><dd className="text-slate-100">{cls}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Generated</dt><dd className="text-slate-100">{new Date().toISOString()}</dd></div>
            </dl>
          </Glass>
          <Glass className="p-4">
            <div className="h-title">Export & context</div>
            <button className="btn-primary mt-2 !py-1.5 text-xs" onClick={exportJson}><Icon name="Download" />Download JSON report</button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">The report records the source, data status, every computed factor and event, and the limitations. NOAA SWPC space weather (Kp, solar wind) is available elsewhere in ORBIT OS as <b>broader environmental context</b> — it is never treated as direct evidence of spoofing or jamming. No result here claims certified navigation safety.</p>
            <div className="mt-2"><div className="h-title">What's next (phase 2)</div><ul className="mt-1 space-y-1 text-[11px] text-slate-400"><li>· RINEX observation ingestion and full pseudorange positioning.</li><li>· Multi-receiver / independent-sensor fusion.</li><li>· Satellite geometry (DOP) and ephemeris from CDDIS.</li><li>· AI analyst summaries over structured detector output.</li></ul></div>
          </Glass>
        </div>
      )}
    </div>
  );
}
