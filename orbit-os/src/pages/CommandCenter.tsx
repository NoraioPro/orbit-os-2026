import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveBadge, OsloClock } from '../components/Layout';
import { OrbitGlobe, type GlobeFocus } from '../components/OrbitGlobe';
import { QuickInvestigation } from '../components/QuickInvestigation';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { DATASETS } from '../data/datasets';
import { flagEvidence, nearestPlaceName, TYPE_META } from '../data/events';
import { trendEvidence } from '../data/evidence';
import { firmsCellEvidence, loadFirms } from '../data/harvest';
import { AGENTS, MODULES, SDGS } from '../data/modules';
import { getPowerSeries, PLACES } from '../data/power';
import { signed, type DataStatus, type EvidencePack } from '../kernel';
import { useStore } from '../state/store';
import { useAssets } from '../data/assets';
import { NarrationButton } from '../components/Narration';
import { IntroVideo, introSeen } from '../components/IntroVideo';

interface Insight { id: string; icon: string; color: string; title: string; line: string; status: DataStatus; note?: string; lat: number; lng: number; pack: EvidencePack }

async function powerInsight(placeId: string, variable: string, icon: string, color: string, title: string): Promise<Insight> {
  const p = PLACES.find((x) => x.id === placeId)!;
  const s = await getPowerSeries({ lat: p.lat, lon: p.lon, name: p.name, placeId, variable, from: 2001, to: 2025, preferLive: false });
  const pack = trendEvidence(s, 5);
  const slope = pack.metrics[0].value;
  return { id: pack.id, icon, color, title, line: slope.replace('/decade', '/dec'), status: s.status, lat: p.lat, lng: p.lon, pack };
}

function KPI({ icon, value, label, status, hint, onClick, color }: { icon: string; value: string | number; label: string; status: DataStatus; hint: string; onClick?: () => void; color: string }) {
  return (
    <Glass onClick={onClick} className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={`rounded-lg border border-white/10 bg-white/5 p-1.5 ${color}`}><Icon name={icon} className="h-6 w-6" /></div>
        <div className="text-[30px] font-bold leading-none text-white">{value}</div>
      </div>
      <div className="mt-2 text-[12px] text-slate-200" title={hint}>{label}</div>
      <div className="mt-1" title={hint}><StatusBadge status={status} note="app registry" className="!text-[8px]" /></div>
    </Glass>
  );
}

function Callout({ i, side, onClick }: { i: Insight; side: 'l' | 'r'; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`group flex w-[196px] items-center gap-2.5 rounded-xl border border-sky-300/25 bg-slate-900/70 px-2.5 py-2 text-left backdrop-blur-md transition hover:border-sky-300/60 hover:shadow-glow ${side === 'r' ? '' : ''}`}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15" style={{ background: `${i.color}33` }}><Icon name={i.icon} className="h-4 w-4" style={{ color: i.color }} /></div>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-white">{i.title}</div>
        <div className="truncate text-[11px] text-slate-300">{i.line}</div>
        <StatusBadge status={i.status} note={i.note} className="mt-0.5 !text-[8px]" />
      </div>
    </button>
  );
}

export default function CommandCenter() {
  const { db, history, reviews, openEvidence } = useStore();
  const assets = useAssets();
  const nav = useNavigate();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [showIntro, setShowIntro] = useState(() => !introSeen());

  useEffect(() => {
    Promise.all([
      powerInsight('svalbard', 'T2M', 'Snowflake', '#7dd3fc', 'Svalbard warming'),
      powerInsight('norway', 'T2M', 'Leaf', '#4ade80', 'Norway temperature'),
      powerInsight('atlantic', 'T2M', 'Waves', '#38bdf8', 'Atlantic air temp'),
      powerInsight('sahel', 'PRECTOTCORR', 'Droplets', '#60a5fa', 'Sahel rainfall'),
    ]).then((a) => setInsights((prev) => [...a, ...prev.filter((x) => x.id.startsWith('flag:'))])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!db) return;
    const pick = (t: string) => db.flags.find((f) => f.type === t);
    const fl = [pick('wildfires'), pick('earthquake')].filter(Boolean).map((f) => {
      const pack = flagEvidence(db, f!);
      const place = nearestPlaceName(db, f!.lat, f!.lon, f!.type);
      return { id: pack.id, icon: f!.type === 'wildfires' ? 'Flame' : 'Activity', color: TYPE_META[f!.type].color, title: f!.type === 'wildfires' ? 'Wildfire surge' : 'Quake cluster', line: `${place.split(',')[0]} · ${f!.previous}→${f!.current} / 7d`, status: 'snapshot' as const, lat: f!.lat, lng: f!.lon, pack };
    });
    setInsights((prev) => [...prev.filter((x) => !x.id.startsWith('flag:') || x.id === 'flag:firms'), ...fl.map((x) => ({ ...x, status: db.status, note: db.status === 'live' ? 'live harvest' : undefined }))]);
  }, [db]);
  useEffect(() => {
    loadFirms().then((g) => {
      const top = [...g.cells].sort((a, b) => b[3] - a[3])[0];
      if (!top) return;
      const pack = firmsCellEvidence(g, top);
      setInsights((prev) => [...prev.filter((x) => x.id !== 'flag:firms'), { id: 'flag:firms', icon: 'Flame', color: '#fde047', title: 'Fire hotspot (FIRMS)', line: `${top[2]} detections · ${Math.round(top[3]).toLocaleString('en-US')} MW`, status: 'live', note: 'live harvest', lat: top[0], lng: top[1], pack }]);
    }).catch(() => {});
  }, []);

  const left = insights.filter((i) => !i.id.startsWith('flag:')).slice(0, 3);
  const rank = (id: string) => (id === 'flag:firms' ? 0 : id.startsWith('flag:wildfires') ? 1 : id.startsWith('flag:') ? 2 : 3);
  const right = [...insights.filter((i) => i.id.startsWith('flag:')), ...insights.filter((i) => !i.id.startsWith('flag:')).slice(3)].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, 3);
  const open = (i: Insight) => { setFocus({ lat: i.lat, lng: i.lng, altitude: 1.7 }); openEvidence(i.pack); };

  const connected = DATASETS.filter((d) => d.connection !== 'planned').length;
  const activeInv = history.filter((h) => (reviews[h.evidence.id]?.state ?? 'pending') === 'pending').length;
  const recent = history.length ? history.slice(0, 3).map((h) => ({ title: h.evidence.title, line: h.plan.question, status: h.evidence.status, pack: h.evidence, conf: h.evidence.confidence.level }))
    : insights.slice(0, 3).map((i) => ({ title: i.pack.title, line: `${i.line} · starter analysis`, status: i.status, pack: i.pack, conf: i.pack.confidence.level }));

  return (
    <div className="relative flex h-full min-h-[690px] flex-col gap-3">
      <IntroVideo open={showIntro} onClose={() => setShowIntro(false)} narration={assets.intro} />
      {assets.hero && <img src={assets.hero} alt="" aria-hidden className="pointer-events-none absolute inset-0 -z-0 h-full w-full rounded-2xl object-cover opacity-[.12] mix-blend-screen" />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-white">ORBIT <span className="font-normal">Command Center</span></h1>
          <p className="text-sm text-slate-300">From Space Data to Real-World Decisions · <span className="text-sky-300">One Change Engine, Many Worlds</span></p>
          {db && <p className="mt-0.5 text-[11px] text-slate-400">Events: <span className={db.status === 'live' ? 'text-emerald-300' : 'text-sky-300'}>{db.label}</span> · {db.events.length.toLocaleString('en-US')} records</p>}
        </div>
        <div className="flex items-center gap-4"><button onClick={() => setShowIntro(true)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200 transition hover:border-sky-300/60 hover:text-white">▶ Intro video</button><NarrationButton src={assets.intro} label="Narration" /><LiveBadge /><OsloClock /></div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_290px] gap-3 overflow-hidden">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <KPI icon="Satellite" value={connected} label="Active Datasets" status="live" hint={`${connected} connected or bundled of ${DATASETS.length} in the catalog (app registry)`} onClick={() => nav('/data')} color="text-sky-300" />
            <KPI icon="BrainCircuit" value={AGENTS.length} label="AI Agents" status="live" hint="Kernel agents registered in this app" onClick={() => nav('/agents')} color="text-violet-300" />
            <KPI icon="Box" value={MODULES.length} label="Solution Modules" status="live" hint="Sector modules in the registry" onClick={() => nav('/solutions')} color="text-indigo-300" />
            <KPI icon="Target" value={activeInv} label="Active Investigations" status="live" hint="Your investigations still pending human review (this device)" onClick={() => nav('/analysis')} color="text-cyan-300" />
          </div>
          <QuickInvestigation />
        </div>

        <div className="relative min-h-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 z-[2] flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
            {Object.entries(TYPE_META).filter(([k]) => db?.meta.by_type[k]).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} />{v.label} {db ? (db.meta.by_type[k] ?? 0).toLocaleString('en-US') : ''}</span>)}
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />FIRMS fires (24 h, 1° cells)</span>
            <span>◎ rings = {db?.flags.length ?? '…'} DG-04 flags</span>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,.28),rgba(59,130,246,.10)_55%,transparent_70%)] blur-2xl" />
          <SatelliteArt />
          <div className="absolute inset-0"><OrbitGlobe db={db} focus={focus} autoRotate /></div>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-around py-10"><div className="pointer-events-auto flex flex-col gap-10">{left.map((i, k) => <div key={i.id} style={{ marginLeft: k === 1 ? 0 : 36 }}><Callout i={i} side="l" onClick={() => open(i)} /></div>)}</div></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-around py-10"><div className="pointer-events-auto flex flex-col items-end gap-10">{right.map((i, k) => <div key={i.id} style={{ marginRight: k === 1 ? 0 : 30 }}><Callout i={i} side="r" onClick={() => open(i)} /></div>)}</div></div>
          {!db && <div className="absolute inset-x-0 bottom-4 text-center text-xs text-slate-400">Loading 17,186 snapshot records…</div>}
        </div>

        <div className="flex flex-col gap-3">
          <Glass className="p-3">
            <div className="flex items-center gap-2"><SdgWheel /><div><div className="h-title">Sustainable Development Goals</div><div className="text-[11px] text-slate-400">Modules mapped to UN SDGs</div></div></div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {[2, 11, 13, 14, 15].map((n) => (
                <button key={n} onClick={() => nav('/sdgs')} className="flex aspect-[3/4] flex-col items-start justify-between rounded-md p-1.5 text-left transition hover:scale-105" style={{ background: SDGS[n].color }}>
                  <span className="text-lg font-bold leading-none">{n}</span>
                  <span className="text-[8.5px] font-semibold leading-tight">{SDGS[n].name}</span>
                  <span className="text-[8.5px] opacity-90">{MODULES.filter((m) => m.sdgs.includes(n)).length} mod.</span>
                </button>
              ))}
            </div>
          </Glass>
          <Glass className="flex-1 p-3">
            <div className="mb-2 flex items-center justify-between"><div className="h-title">Recent Analyses</div><button onClick={() => nav('/analysis')} className="text-xs text-sky-300 hover:underline">View All</button></div>
            <div className="space-y-2">
              {recent.map((r, k) => (
                <button key={k} onClick={() => openEvidence(r.pack)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-2 text-left hover:border-sky-300/40">
                  <div className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-600/50 to-emerald-600/40"><Icon name={r.pack.kind === 'anomaly' ? 'Flame' : r.pack.kind === 'transfer' ? 'Orbit' : 'ChartColumn'} className="h-5 w-5 text-white" /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold text-white">{r.title}</div><div className="truncate text-[11px] text-slate-400">{r.line}</div><StatusBadge status={r.status} className="!text-[8px]" /></div>
                  <Icon name={r.conf === 'high' ? 'CircleCheck' : 'TriangleAlert'} className={`h-4 w-4 ${r.conf === 'high' ? 'text-emerald-400' : 'text-amber-400'}`} />
                </button>
              ))}
              {!recent.length && <div className="text-xs text-slate-500">Computing starter analyses…</div>}
            </div>
          </Glass>
        </div>
      </div>

      <Glass className="p-3">
        <div className="mb-2 flex items-center justify-between"><div className="text-lg font-semibold text-white">Solution Modules</div><button onClick={() => nav('/solutions')} className="text-xs text-sky-300 hover:underline">All Modules →</button></div>
        <div className="grid grid-cols-10 gap-2">
          {MODULES.map((m) => (
            <button key={m.id} title={m.tagline} onClick={() => nav(`/module/${m.id}`)} className={`group relative flex h-[104px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b ${m.gradient} p-2 text-center transition duration-200 hover:-translate-y-1 hover:border-sky-300/60 hover:shadow-glow`}>
              {assets.modules[m.id]?.image && <img src={assets.modules[m.id].image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-300 group-hover:scale-110 group-hover:opacity-90" />}
              <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <Icon name={m.icon} className="relative h-8 w-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,.5)] transition duration-200 group-hover:scale-110" />
              <span className="relative text-[12px] font-semibold leading-tight text-white">{m.name}</span>
              <span className="absolute right-1 top-1 rounded bg-black/40 px-1 text-[8px] text-slate-200">{m.release}</span>
              <span className="pointer-events-none absolute -bottom-6 left-1/2 h-10 w-[140%] -translate-x-1/2 rounded-[50%] bg-sky-400/20 blur-md" />
            </button>
          ))}
        </div>
      </Glass>
    </div>
  );
}

function SatelliteArt() {
  return (
    <svg viewBox="0 0 120 60" className="pointer-events-none absolute right-[18%] top-0 z-[1] h-12 w-24 opacity-90 drop-shadow-[0_0_8px_rgba(56,189,248,.6)] float">
      <g transform="rotate(-18 60 30)">
        <rect x="4" y="22" width="40" height="16" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1" />
        <path d="M14 22v16M24 22v16M34 22v16" stroke="#60a5fa" strokeWidth=".8" />
        <rect x="76" y="22" width="40" height="16" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1" />
        <path d="M86 22v16M96 22v16M106 22v16" stroke="#60a5fa" strokeWidth=".8" />
        <rect x="48" y="18" width="24" height="24" rx="3" fill="#cbd5e1" stroke="#f8fafc" />
        <path d="M44 30h4M72 30h4" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="60" cy="14" r="4" fill="none" stroke="#fde68a" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function SdgWheel() {
  const cols = ['#E5243B', '#DDA63A', '#4C9F38', '#C5192D', '#FF3A21', '#26BDE2', '#FCC30B', '#A21942', '#FD6925', '#DD1367', '#FD9D24', '#BF8B2E', '#3F7E44', '#0A97D9', '#56C02B', '#00689D', '#19486A'];
  return (
    <svg viewBox="-20 -20 40 40" className="h-9 w-9">
      {cols.map((c, i) => { const a0 = (i / 17) * 2 * Math.PI, a1 = ((i + 1) / 17) * 2 * Math.PI; return <path key={i} d={`M${18 * Math.cos(a0)},${18 * Math.sin(a0)} A18,18 0 0 1 ${18 * Math.cos(a1)},${18 * Math.sin(a1)} L${10 * Math.cos(a1)},${10 * Math.sin(a1)} A10,10 0 0 0 ${10 * Math.cos(a0)},${10 * Math.sin(a0)} Z`} fill={c} />; })}
    </svg>
  );
}
