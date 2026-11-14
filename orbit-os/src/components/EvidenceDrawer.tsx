import { useEffect, useState } from 'react';
import { PATTERNS, saveReview, type EvidencePack, type ReviewState } from '../kernel';
import { useStore } from '../state/store';
import { LineChart } from './LineChart';
import { sonify } from './sonify';
import { Chip, ConfidencePill, Icon, StatusBadge } from './ui';

export function EvidenceDrawer() {
  const { evidence: e, openEvidence, reviews, saveReport } = useStore();
  const [note, setNote] = useState('');
  useEffect(() => { setNote(e ? reviews[e.id]?.note ?? '' : ''); }, [e?.id]);
  useEffect(() => { const k = (ev: KeyboardEvent) => ev.key === 'Escape' && openEvidence(null); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [openEvidence]);
  if (!e) return null;
  const rv = reviews[e.id];
  const setRv = (state: ReviewState) => saveReview({ id: e.id, state, note, at: new Date().toISOString() });
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' })); a.download = `orbit-evidence-${e.id.replace(/[^a-z0-9]+/gi, '-')}.json`; a.click(); };
  return (
    <div className="fade-in fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => openEvidence(null)}>
      <aside role="dialog" aria-label="Evidence pack" className="drawer-in glass scroll-thin m-3 flex w-[560px] max-w-[95vw] flex-col overflow-y-auto rounded-2xl border-sky-300/25 bg-slate-950/90 p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-sky-300"><Icon name="ShieldCheck" className="h-3.5 w-3.5" />Evidence pack · {e.kind}</div>
            <h2 className="text-xl font-bold text-white">{e.title}</h2>
            {e.subtitle && <p className="text-sm text-slate-400">{e.subtitle}</p>}
          </div>
          <button aria-label="Close" className="rounded-lg p-1 hover:bg-white/10" onClick={() => openEvidence(null)}><Icon name="X" className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={e.status} note={e.statusLabel} />
          <ConfidencePill level={e.confidence.level} />
          <Chip><Icon name="Clock" className="h-3 w-3" />{e.window.start}{e.window.end !== e.window.start ? ` → ${e.window.end}` : ''}{e.window.label ? ` · ${e.window.label}` : ''}</Chip>
          {e.location && <Chip><Icon name="Target" className="h-3 w-3" />{e.location.name}{e.location.radiusKm ? ` · r ${e.location.radiusKm} km` : ''}</Chip>}
        </div>

        <section className="mt-4 grid grid-cols-2 gap-2">
          {e.metrics.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[.03] p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400"><span className="truncate" title={m.label}>{m.label}</span><StatusBadge status={m.status} /></div>
              <div className="mt-1 text-sm font-semibold text-white">{m.value}</div>
            </div>
          ))}
        </section>

        {e.series && (
          <section className="mt-4 rounded-xl border border-white/10 bg-white/[.02] p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{e.series.label}{e.series.trend ? ' · dashed = OLS fit' : ''}</span>
              <button className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sky-300 hover:bg-sky-500/10" onClick={() => sonify(e.series!.points)} title="Challenge 14: hear the data"><Icon name="Music" className="h-3.5 w-3.5" />Listen</button></div>
            <LineChart points={e.series.points} trend={e.series.trend} unit={e.series.unit} bars={e.kind === 'anomaly' || e.kind === 'investigation'} color={e.kind === 'anomaly' ? '#f97316' : '#38bdf8'} xLabel={e.kind === 'anomaly' || e.kind === 'investigation' ? (x) => (x === 0 ? 'snapshot' : `${x} d`) : undefined} />
          </section>
        )}

        <section className="mt-4 space-y-2 text-sm">
          <div><div className="text-[11px] uppercase tracking-wider text-slate-500">Confidence rationale</div><p className="text-slate-300">{e.confidence.rationale} <span className="text-slate-500">(score {(e.confidence.score * 100).toFixed(0)}/100)</span></p></div>
          <div><div className="text-[11px] uppercase tracking-wider text-slate-500">Method</div><p className="text-slate-300">{e.method}</p></div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Sources</div>
            <ul className="mt-1 space-y-1">{e.sources.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-300"><Icon name="Database" className="mt-0.5 h-3.5 w-3.5 text-sky-300" /><span>{s.url ? <a className="text-sky-300 underline-offset-2 hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}{s.retrieved && <span className="text-slate-500"> · retrieved {s.retrieved.replace('T', ' ').slice(0, 16)} UTC</span>}</span></li>
            ))}</ul>
          </div>
          <div><div className="text-[11px] uppercase tracking-wider text-slate-500">Limitations</div><ul className="ml-4 list-disc text-slate-400">{e.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></div>
          <div className="flex flex-wrap gap-1.5">{e.patterns.map((p) => <Chip key={p} className="border-violet-400/30 text-violet-200">kernel · {PATTERNS[p].short}</Chip>)}</div>
        </section>

        {e.records && e.records.length > 0 && (
          <section className="mt-4">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Underlying records ({e.records.length} shown)</div>
            <div className="scroll-thin max-h-48 overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-xs"><tbody>{e.records.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0"><td className="px-2 py-1.5 text-slate-200">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-sky-300">{r.title}</a> : r.title}</td><td className="whitespace-nowrap px-2 text-slate-500">{r.time}</td><td className="px-2 text-right text-slate-300">{r.value}</td></tr>
              ))}</tbody></table>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
          <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-violet-200">Human review</span><span className="text-slate-400">Status: <b className="text-white">{rv?.state ?? 'pending'}</b>{rv && ` · ${rv.at.slice(0, 16).replace('T', ' ')} UTC`}</span></div>
          <textarea className="input h-16 resize-none" placeholder="Reviewer note (stays on this device)" value={note} onChange={(ev) => setNote(ev.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-ghost !py-1.5 text-emerald-300" onClick={() => setRv('confirmed')}><Icon name="CircleCheck" />Confirm</button>
            <button className="btn-ghost !py-1.5 text-slate-300" onClick={() => setRv('dismissed')}><Icon name="X" />Dismiss</button>
            <button className="btn-ghost !py-1.5 text-amber-300" onClick={() => setRv('escalated')}><Icon name="TriangleAlert" />Escalate</button>
            <div className="flex-1" />
            <button className="btn-ghost !py-1.5" onClick={() => saveReport(e)}><Icon name="FileText" />Save to Reports</button>
            <button className="btn-ghost !py-1.5" onClick={download}><Icon name="Download" />JSON</button>
          </div>
        </section>
      </aside>
    </div>
  );
}
