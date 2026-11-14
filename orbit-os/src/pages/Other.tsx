import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const OrbitGlobe = lazy(() => import('../components/OrbitGlobe').then((m) => ({ default: m.OrbitGlobe })));
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { DATASETS } from '../data/datasets';
import { eventEvidence, isoMin, TYPE_META } from '../data/events';
import { AGENTS, CHALLENGES, MODULES, SDGS } from '../data/modules';
import { CHALLENGE_META } from '../data/challenges';
import { PATTERNS, type PatternId } from '../kernel';
import { useStore } from '../state/store';
import { HarvestManifestTable } from '../modules/harvestWidgets';

export function Explore() {
  const { db, openEvidence } = useStore();
  const [types, setTypes] = useState<string[]>(Object.keys(TYPE_META));
  const [q, setQ] = useState('');
  const list = useMemo(() => (db ? db.events.filter((e) => types.includes(e.type) && (!q || e.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 200) : []), [db, types, q]);
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon="Compass" title="Explore" subtitle={`${db?.events.length.toLocaleString('en-US') ?? '…'} event records + FIRMS fire cells on NASA GIBS imagery`} right={db ? <StatusBadge status={db.status} note={db.label} /> : undefined} />
      <div className="grid min-h-[620px] flex-1 grid-cols-[minmax(0,1fr)_340px] gap-3">
        <Glass className="relative overflow-hidden"><Suspense fallback={<div className="grid h-full min-h-80 place-items-center text-xs text-slate-500">Loading globe…</div>}><OrbitGlobe db={db} types={types} autoRotate defaultLayer="VIIRS_NOAA20_CorrectedReflectance_TrueColor" initial={{ lat: 20, lng: -40, altitude: 2.3 }} /></Suspense></Glass>
        <Glass className="flex min-h-0 flex-col p-3">
          <div className="flex flex-wrap gap-1">{Object.entries(TYPE_META).map(([k, v]) => <button key={k} onClick={() => setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))} className={`rounded-full border px-2 py-0.5 text-[11px] ${types.includes(k) ? 'border-white/20 text-white' : 'border-transparent text-slate-500'}`}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: v.color }} />{v.label}</button>)}</div>
          <input className="input mt-2" placeholder="Filter by title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="scroll-thin mt-2 flex-1 overflow-y-auto text-xs">{list.map((e) => <button key={e.id} onClick={() => db && openEvidence(eventEvidence(db, e))} className="block w-full border-b border-white/5 py-1.5 text-left hover:text-sky-300"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TYPE_META[e.type]?.color }} />{e.title}<div className="text-slate-500">{isoMin(e.t)}</div></button>)}</div>
        </Glass>
      </div>
    </div>
  );
}

export function Missions() {
  const nav = useNavigate();
  const steps = [
    { w: 'Earth', icon: 'Globe2', t: 'Prove it on Earth', d: 'Earth Pulse change engine on real NASA POWER / EONET / USGS data, with evidence packs and review.', to: '/module/earth', s: 'live' as const },
    { w: 'Analog', icon: 'Mountain', t: 'Pick the analog site', d: 'Transfer engine ranks Atacama, Dry Valleys, Svalbard… against Moon/Mars profiles.', to: '/module/explorer', s: 'snapshot' as const },
    { w: 'Moon', icon: 'Moon', t: 'Lunar site navigator', d: 'Same change + planning kernel on lunar south-pole scenarios (challenge 11 prototype).', to: '/module/explorer', s: 'sample' as const },
    { w: 'Mars', icon: 'Orbit', t: 'Mars route + outpost', d: 'Energy-limited routing and mass-budget outpost design (challenges 10, 13, 3).', to: '/module/autonomy', s: 'sample' as const },
  ];
  return (
    <div>
      <PageHeader icon="Rocket" title="Missions · One Change Engine, Many Worlds" subtitle="Replay a mission decision on an Earth analog first, then move the same kernel to the Moon and Mars." />
      <div className="grid grid-cols-4 gap-3">{steps.map((s, i) => (
        <Glass key={i} onClick={() => nav(s.to)} className="p-4">
          <div className="flex items-center justify-between"><Icon name={s.icon} className="h-8 w-8 text-sky-300" /><StatusBadge status={s.s} /></div>
          <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">Step {i + 1} · {s.w}</div>
          <div className="text-lg font-semibold text-white">{s.t}</div><p className="mt-1 text-xs text-slate-400">{s.d}</p>
        </Glass>))}</div>
      <Glass className="mt-3 p-4 text-sm text-slate-300"><div className="h-title mb-2">Why this pattern wins</div>Every Space Apps challenge in this set is one of six problems in disguise. ORBIT implements those six once, in the kernel, and every module calls the same functions. Earth data validates the methods; the Moon and Mars inherit them.</Glass>
    </div>
  );
}

export function Solutions() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader icon="Puzzle" title="Solutions" subtitle="14 challenge prototypes, each mapped to the ORBIT module that implements it. Prototypes use synthetic sample data." />
      <div className="grid grid-cols-4 gap-3">{CHALLENGES.map((c) => { const mods = MODULES.filter((m) => m.challenges.includes(c.n)); const meta = CHALLENGE_META[c.n]; return (
        <Glass key={c.n} onClick={() => nav(`/solution/${c.n}`)} className="flex flex-col p-3">
          <div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">Challenge {c.n}</span><StatusBadge status="sample" /></div>
          <div className="font-semibold text-white">{c.name}</div>
          {meta?.difficulty && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{meta.difficulty}</div>}
          <div className="mt-2 flex flex-wrap gap-1">{mods.map((m) => <Chip key={m.id} className="border-sky-400/30 text-sky-200">{m.name}</Chip>)}{!mods.length && <Chip>prototype only</Chip>}</div>
          <div className="mt-auto pt-2 text-xs text-sky-300">Open in ORBIT →</div>
        </Glass>); })}</div>
    </div>
  );
}

export function SDGs() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader icon="Target" title="Sustainable Development Goals" subtitle="Which ORBIT modules contribute to which UN SDGs (design mapping, not impact measurement)." />
      <div className="grid grid-cols-3 gap-3">{Object.entries(SDGS).map(([n, s]) => (
        <Glass key={n} className="flex gap-3 p-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-2xl font-bold" style={{ background: s.color }}>{n}</div>
          <div><div className="font-semibold text-white">{s.name}</div><div className="mt-1 flex flex-wrap gap-1">{MODULES.filter((m) => m.sdgs.includes(+n)).map((m) => <button key={m.id} onClick={() => nav(`/module/${m.id}`)}><Chip>{m.name}</Chip></button>)}</div></div>
        </Glass>))}</div>
    </div>
  );
}

export function Reports() {
  const { reports, history, openEvidence, reviews } = useStore();
  const all = [...reports, ...history.map((h) => h.evidence).filter((e) => !reports.some((r) => r.id === e.id))];
  const md = () => {
    const txt = all.map((e) => `## ${e.title}\n\nStatus: **${e.status}** · Confidence: **${e.confidence.level}** · Review: ${reviews[e.id]?.state ?? 'pending'}\n\nWindow: ${e.window.start} → ${e.window.end}\n\n${e.metrics.map((m) => `- ${m.label}: ${m.value} [${m.status}]`).join('\n')}\n\nMethod: ${e.method}\n\nSources: ${e.sources.map((s) => `${s.name}${s.url ? ` (${s.url})` : ''}`).join('; ')}\n\nLimitations: ${e.limitations.join(' ')}\n`).join('\n---\n\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`# ORBIT OS report\n\nGenerated ${new Date().toISOString()}\n\n${txt}`], { type: 'text/markdown' })); a.download = 'orbit-report.md'; a.click();
  };
  return (
    <div>
      <PageHeader icon="FileText" title="Reports" subtitle="Saved evidence packs and investigations, with provenance. Export as Markdown." right={<button className="btn-primary" onClick={md} disabled={!all.length}><Icon name="Download" />Export Markdown</button>} />
      {all.length ? <div className="grid grid-cols-2 gap-2">{all.map((e) => <Glass key={e.id} onClick={() => openEvidence(e)} className="flex items-center justify-between p-3"><div><div className="font-semibold text-white">{e.title}</div><div className="text-xs text-slate-400">{e.window.start} → {e.window.end} · review {reviews[e.id]?.state ?? 'pending'}</div></div><StatusBadge status={e.status} /></Glass>)}</div> : <Glass className="p-4 text-sm text-slate-400">Nothing yet. Open any evidence pack and press “Save to Reports”, or run a Quick Investigation.</Glass>}
    </div>
  );
}

export function DataHub() {
  const { db } = useStore();
  return (
    <div>
      <PageHeader icon="Database" title="Data Hub" subtitle="Every connector, its status and what uses it. Planned connectors never show numbers." />
      <Glass className="overflow-hidden p-0"><table className="w-full text-xs"><thead className="bg-white/5 text-left text-slate-400"><tr><th className="p-3">Dataset</th><th>Provider</th><th>Connection</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>{DATASETS.map((d) => <tr key={d.id} className="border-t border-white/5"><td className="p-3 font-medium text-white">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="hover:text-sky-300">{d.name}</a> : d.name}</td><td className="text-slate-300">{d.provider}</td><td className="text-slate-300">{d.connection}</td><td><StatusBadge status={d.status} /></td><td className="pr-3 text-slate-400">{d.note}</td></tr>)}</tbody></table></Glass>
      <HarvestManifestTable />
      {db && <Glass className="mt-3 p-4 text-xs text-slate-300"><div className="h-title mb-1">Active event source: {db.label}</div><pre className="whitespace-pre-wrap text-slate-400">{JSON.stringify(db.meta, null, 2)}</pre></Glass>}
    </div>
  );
}

export function Agents() {
  return (
    <div>
      <PageHeader icon="BrainCircuit" title="AI Agents · the ORBIT kernel" subtitle="Six repeating patterns implemented once. Agents are deterministic functions; an LLM may only plan and narrate, never produce numbers." />
      <div className="grid grid-cols-3 gap-3">{AGENTS.map((a) => (
        <Glass key={a.id} className="p-4"><div className="flex items-center gap-2"><Icon name="Cpu" className="h-5 w-5 text-violet-300" /><div className="font-semibold text-white">{a.name}</div></div><p className="mt-1 text-xs text-slate-300">{a.does}</p><div className="mt-2"><Chip>kernel · {PATTERNS[a.pattern].name}</Chip></div>
          <div className="mt-2 text-[11px] text-slate-500">Used by: {MODULES.filter((m) => m.patterns.includes(a.pattern as PatternId)).map((m) => m.name).join(', ') || 'Quick Investigation'}</div></Glass>))}</div>
      <Glass className="mt-3 p-4"><div className="h-title mb-2">Patterns</div><div className="grid grid-cols-2 gap-2 text-xs">{Object.entries(PATTERNS).map(([k, p]) => <div key={k} className="rounded-lg border border-white/10 p-2"><b className="text-white">{p.name}</b><div className="text-slate-400">{p.description}</div><code className="text-[10px] text-sky-300">src/kernel/{k === 'review' ? 'review' : k}.ts</code></div>)}</div></Glass>
    </div>
  );
}

export function SettingsPage() {
  const { settings, setSettings, llm, live } = useStore();
  return (
    <div>
      <PageHeader icon="Settings" title="Settings" subtitle="Everything here is stored on this device only." />
      <Glass className="max-w-2xl space-y-4 p-4 text-sm">
        <label className="flex items-center justify-between gap-4"><span><b className="text-white">Use live keyless APIs</b><div className="text-xs text-slate-400">NASA POWER, NASA EONET, USGS FDSN. Off = offline snapshot mode. Currently: {live ? 'reachable' : 'not reachable / off'}.</div></span><input type="checkbox" checked={settings.preferLive} onChange={(e) => setSettings({ ...settings, preferLive: e.target.checked })} /></label>
        <label className="flex items-center justify-between gap-4"><span><b className="text-white">Use LLM planner/narrator when configured</b><div className="text-xs text-slate-400">{llm.configured ? `Configured on the dev server: ${llm.model}` : 'Not configured. Set ORBIT_LLM_API_KEY in .env (see .env.example). The deterministic planner is used.'}</div></span><input type="checkbox" checked={settings.useLlm} onChange={(e) => setSettings({ ...settings, useLlm: e.target.checked })} /></label>
        <label className="flex items-center justify-between gap-4"><span><b className="text-white">Event data source</b><div className="text-xs text-slate-400">Collector harvest = live, 14k events across every type (floods, storms, volcanoes, fires, ice, quakes). Shards = 17k quake/fire-heavy snapshot (11:39 UTC, few floods/storms).</div></span><select className="input !w-auto" value={settings.dataSource} onChange={(e) => setSettings({ ...settings, dataSource: e.target.value as 'harvest' | 'shards' })}><option value="harvest">Collector harvest</option><option value="shards">86 data shards</option></select></label>
        <button className="btn-ghost" onClick={() => { ['orbit.history.v1', 'orbit.reports.v1', 'orbit.review.v1'].forEach((k) => localStorage.removeItem(k)); location.reload(); }}><Icon name="X" />Clear local history, reports and reviews</button>
      </Glass>
    </div>
  );
}
