import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LineChart } from '../components/LineChart';
import { Chip, ConfidencePill, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { NarrationButton } from '../components/Narration';
import { DATASETS } from '../data/datasets';
import { moduleById } from '../data/modules';
import { POWER_VARS } from '../data/power';
import type { InvestigationPlan } from '../investigate/plan';
import { investigate, type InvestigationResult } from '../investigate/run';
import { useStore } from '../state/store';

const EXAMPLES = ['Show vegetation change in Norway last 5 years', 'Is Svalbard warming since 2001?', 'Any unusual wildfire activity in the last 7 days?', 'How many earthquakes near Tokyo in the last 30 days?', 'Is soil getting drier in the Sahel since 2005?', 'Which Earth site is the best Mars analog?'];

export default function Analysis() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const q = params.get('q');
  const { settings, llm, addResult, history, openEvidence } = useStore();
  const [plan, setPlan] = useState<InvestigationPlan | null>(null);
  const [res, setRes] = useState<InvestigationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(q ?? '');
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!q || ran.current === q) return;
    ran.current = q; setText(q); setRes(null); setErr(null); setPlan(null);
    investigate(q, { preferLive: settings.preferLive, useLlm: settings.useLlm && llm.configured, onStep: setPlan })
      .then((r) => { setRes(r); setPlan(r.plan); addResult(r); })
      .catch((e) => setErr(String(e?.message || e)));
  }, [q]);

  const shown = res ?? null;
  const p = shown?.plan ?? plan;
  return (
    <div>
      <PageHeader icon="ChartColumn" title="Analysis · Quick Investigation" subtitle="Question → structured plan → kernel computation → evidence pack → human review. Works offline with a deterministic planner; an LLM is optional." right={<NarrationButton src="/assets/audio/analysis.mp3" label="Listen" />} />
      <Glass className="p-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { ran.current = null; nav(`/analysis?q=${encodeURIComponent(text.trim())}`); } }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask ORBIT… e.g. Show vegetation change in Norway last 5 years" />
          <button className="btn-primary shrink-0">Analyze <Icon name="ArrowRight" /></button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((x) => <button key={x} onClick={() => { ran.current = null; nav(`/analysis?q=${encodeURIComponent(x)}`); }} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 hover:border-sky-300/40">{x}</button>)}</div>
        <div className="mt-2 text-[11px] text-slate-500">Planner: {settings.useLlm && llm.configured ? `LLM (${llm.model}) with deterministic validation` : 'deterministic (no LLM configured)'} · Live APIs: {settings.preferLive ? 'on' : 'off'}</div>
      </Glass>

      {err && <Glass className="mt-3 border-rose-400/30 p-4 text-sm text-rose-200"><b>Could not complete:</b> {err}</Glass>}

      {p && (
        <div className="mt-3 grid grid-cols-[360px_minmax(0,1fr)] gap-3">
          <Glass className="p-4">
            <div className="mb-2 flex items-center justify-between"><div className="h-title">Structured plan</div><Chip>{p.planner}</Chip></div>
            <div className="mb-3 grid grid-cols-2 gap-1.5 text-[11px]">
              <Field k="Intent" v={p.intent} /><Field k="Sector" v={moduleById(p.sector)?.name ?? p.sector} />
              <Field k="Place" v={p.place?.name ?? 'Global'} /><Field k={p.intent === 'trend' || p.intent === 'analog' ? 'Years' : 'Days'} v={p.intent === 'trend' || p.intent === 'analog' ? `${p.yearFrom}–${p.yearTo} (recent ${p.recentYears} y)` : `${p.days}`} />
              <Field k="Variables" v={p.intent === 'trend' || p.intent === 'analog' ? p.variables.map((v) => POWER_VARS[v]?.short ?? v).join(', ') : p.eventType ?? 'all types'} />
              <Field k="Datasets" v={p.datasets.map((d) => DATASETS.find((x) => x.id === d)?.name.split(' ')[0] + (DATASETS.find((x) => x.id === d)?.connection === 'planned' ? ' (planned)' : '')).join(', ')} />
            </div>
            <ol className="space-y-1.5">{p.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[.02] p-2 text-xs">
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${s.status === 'done' ? 'bg-emerald-500/80' : s.status === 'failed' ? 'bg-rose-500/80' : s.status === 'skipped' ? 'bg-slate-600' : 'animate-pulse bg-sky-500/60'}`}>{i + 1}</span>
                <div><div className="font-semibold text-slate-100">{s.label} <span className="font-normal text-slate-500">· {s.status}</span></div><div className="text-slate-400">{s.detail}</div></div>
              </li>
            ))}</ol>
            {p.notes.length > 0 && <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/5 p-2 text-[11px] text-amber-200">{p.notes.map((n, i) => <p key={i}>• {n}</p>)}</div>}
          </Glass>

          <Glass className="p-4">
            {!shown ? <div className="grid h-full place-items-center text-sm text-slate-400"><Icon name="Orbit" className="mb-2 h-8 w-8 animate-spin text-sky-300" />Running kernel…</div> : (
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-white">{shown.evidence.title}</h2><StatusBadge status={shown.evidence.status} /><ConfidencePill level={shown.evidence.confidence.level} /></div>
                <p className="mt-2 rounded-xl border border-sky-300/15 bg-sky-500/5 p-3 text-sm text-slate-200"><Icon name="Sparkles" className="mr-1 inline h-4 w-4 text-sky-300" />{shown.narrative} <span className="text-[11px] text-slate-500">({shown.narrator} narrative)</span></p>
                <div className="mt-3 grid grid-cols-3 gap-2">{shown.evidence.metrics.slice(0, 6).map((m, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[.03] p-2.5"><div className="flex justify-between gap-1 text-[11px] text-slate-400"><span className="truncate">{m.label}</span><StatusBadge status={m.status} /></div><div className="mt-1 text-sm font-semibold text-white">{m.value}</div></div>
                ))}</div>
                {shown.evidence.series && <div className="mt-3 rounded-xl border border-white/10 p-2"><div className="text-xs text-slate-400">{shown.evidence.series.label} ({shown.evidence.series.unit})</div><LineChart points={shown.evidence.series.points} trend={shown.evidence.series.trend} unit={shown.evidence.series.unit} bars={shown.evidence.kind !== 'trend' && shown.evidence.kind !== 'fusion'} color={shown.evidence.kind === 'anomaly' ? '#f97316' : '#38bdf8'} height={190} xLabel={shown.evidence.kind === 'trend' || shown.evidence.kind === 'fusion' ? undefined : (x) => (x === 0 ? 'snapshot' : `${x} d`)} /></div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => openEvidence(shown.evidence)}><Icon name="ShieldCheck" />Open evidence pack</button>
                  {shown.extra.map((x) => <button key={x.id} className="btn-ghost" onClick={() => openEvidence(x)}>{x.title.split(' · ')[0]} evidence</button>)}
                  <button className="btn-ghost" onClick={() => nav(`/module/${shown.plan.sector}`)}>Open {moduleById(shown.plan.sector)?.name}</button>
                </div>
              </div>
            )}
          </Glass>
        </div>
      )}

      <Glass className="mt-3 p-4">
        <div className="h-title mb-2">History (this device)</div>
        {history.length ? <div className="grid grid-cols-2 gap-2">{history.slice(0, 10).map((h) => (
          <button key={h.id} onClick={() => openEvidence(h.evidence)} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[.03] p-2 text-left text-xs hover:border-sky-300/40"><span className="truncate"><b className="text-white">{h.plan.question}</b><br /><span className="text-slate-400">{h.evidence.title} · {h.ranAt.slice(0, 16).replace('T', ' ')} UTC</span></span><StatusBadge status={h.evidence.status} /></button>
        ))}</div> : <p className="text-xs text-slate-500">No investigations yet.</p>}
      </Glass>
    </div>
  );
}
const Field = ({ k, v }: { k: string; v: string }) => <div className="rounded-md border border-white/5 bg-white/[.02] px-2 py-1"><div className="text-slate-500">{k}</div><div className="truncate font-medium text-slate-100" title={v}>{v}</div></div>;
