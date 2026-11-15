import { lazy, Suspense, useState, type ComponentType } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { GuidedTour } from '../components/GuidedTour';
import { DATASETS } from '../data/datasets';
import { CHALLENGES, moduleById, SDGS } from '../data/modules';
import { PATTERNS } from '../kernel';
import { EarthPulse } from '../modules/EarthPulse';
import { AcademyWidget, ExplorerWidget, HumanWidget } from '../modules/widgets';
const GnssGuardian = lazy(() => import('../modules/GnssGuardian').then((m) => ({ default: m.GnssGuardian })));
const SarObservatory = lazy(() => import('../modules/SarObservatory').then((m) => ({ default: m.SarObservatory })));
const InfrastructureOslo = lazy(() => import('../modules/InfrastructureOslo').then((m) => ({ default: m.InfrastructureOslo })));
const AgriBoard = lazy(() => import('../modules/AgriBoard').then((m) => ({ default: m.AgriBoard })));
const EvaLab = lazy(() => import('../components/EvaLab').then((m) => ({ default: m.EvaLab })));
const OceanBoard = lazy(() => import('../modules/OceanBoard').then((m) => ({ default: m.OceanBoard })));
const DisasterEventBoard = lazy(() => import('../modules/DisasterEventBoard').then((m) => ({ default: m.DisasterEventBoard })));
const TurkiyeBoard = lazy(() => import('../modules/TurkiyeBoard').then((m) => ({ default: m.TurkiyeBoard })));
import { QuickInvestigation } from '../components/QuickInvestigation';
import { HarvestPulse, SpaceWeather } from '../modules/harvestWidgets';
import { useAssets } from '../data/assets';
import { NarrationButton } from '../components/Narration';
import { NorwayLive } from '../modules/NorwayLive';
import { EarthStory } from '../modules/EarthStory';
import { SarStory } from '../modules/SarStory';
import { SvalbardLenses } from '../modules/SvalbardLenses';
import { OceanStory } from '../modules/OceanStory';
import { ExplorerStory } from '../modules/ExplorerStory';
import { MissionStory } from '../modules/MissionStory';
import { HumanStory } from '../modules/HumanStory';
import { RealQuakeCase } from '../modules/RealQuakeCase';
const StoryGlobe = lazy(() => import('../components/StoryGlobe').then((m) => ({ default: m.StoryGlobe })));
import { WeatherNow, WEATHER_SITES } from '../components/WeatherNow';
import { STORIES } from '../data/stories';
import { GUIDES } from '../data/guides';
import { TOURS } from '../data/tours';
import { useStore } from '../state/store';

const HumanLab = lazy(() => import('../modules/HumanLab').then((m) => ({ default: m.HumanLab })));
const SolarFish = lazy(() => import('../modules/SolarFish').then((m) => ({ default: m.SolarFish })));
const MissionAcademyPro = lazy(() => import('../modules/MissionAcademyPro').then((m) => ({ default: m.MissionAcademyPro })));
const SituationRoom = lazy(() => import('../modules/SituationRoom').then((m) => ({ default: m.SituationRoom })));
const SarGlobe = lazy(() => import('../modules/SarGlobe').then((m) => ({ default: m.SarGlobe })));
const PredictionPanel = lazy(() => import('../modules/PredictionPanel').then((m) => ({ default: m.PredictionPanel })));
const EarthTrendDetective = lazy(() => import('../modules/EarthTrendDetective').then((m) => ({ default: m.EarthTrendDetective })));
const EarthJukebox = lazy(() => import('../modules/EarthJukebox').then((m) => ({ default: m.EarthJukebox })));
const CropWatch = lazy(() => import('../modules/CropWatch').then((m) => ({ default: m.CropWatch })));
const FireCalendar = lazy(() => import('../modules/FireCalendar').then((m) => ({ default: m.FireCalendar })));
const SarChampion = lazy(() => import('../modules/SarChampion').then((m) => ({ default: m.SarChampion })));
const SarFaultLab = lazy(() => import('../modules/SarFaultLab').then((m) => ({ default: m.SarFaultLab })));
const SkyChangeViewer = lazy(() => import('../modules/SkyChangeViewer').then((m) => ({ default: m.SkyChangeViewer })));
const SpaceExplorerPro = lazy(() => import('../modules/SpaceExplorerPro').then((m) => ({ default: m.SpaceExplorerPro })));

const EarthSuite: ComponentType = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-3">
      <div className="space-y-3"><EarthPulse /><HarvestPulse /></div>
      <div className="space-y-3">
        <QuickInvestigation compact />
        <Glass className="p-4 text-xs text-slate-300"><div className="h-title mb-1">Earth Pulse bundle</div>Challenges 2 (trend), 5 (radar change), 6 (field shift), 8 (fire calendar) and 14 (sonification) share one change engine. Challenge 7 (ISS combustion) is deliberately <b>not</b> merged with Earth fire data.</Glass>
      </div>
    </div>
    <EarthTrendDetective />
    <PredictionPanel />
    <EarthJukebox />
  </div>
);
const DisasterSuite: ComponentType = () => <div className="space-y-3"><RealQuakeCase /><FireCalendar /></div>;
const SarSuite: ComponentType = () => <div className="space-y-3"><SarFaultLab /><SarGlobe /><SarChampion /></div>;
const OceanSuite: ComponentType = () => <div className="space-y-3"><OceanBoard /><NorwayLive aoiId="barents" title="Barents Sea live state · routing at the ice margin" /><SolarFish /></div>;
const ExplorerSuite: ComponentType = () => <div className="space-y-3"><SpaceWeather /><SpaceExplorerPro /><SkyChangeViewer /></div>;
const HumanSuite: ComponentType = () => (
  <div className="space-y-3">
    {/* the EVA build-lab artifact replaces the earlier digital-twin tile */}
    <EvaLab height={820} />
    <HumanLab />
  </div>
);


/** Infrastructure: the Oslo SAR/InSAR situation board leads, the existing exposure widget follows. */
function InfraSuite() {
  return (
    <div className="space-y-3">
      <NorwayLive aoiId="oslo" title="Oslo live context · wind, precipitation and air quality" />
      <InfrastructureOslo />
    </div>
  );
}


/** Agri: the Østfold crop board leads (real POWER + GIBS), the planning widget follows. */
function AgriSuite() {
  return (
    <div className="space-y-3">
      <NorwayLive aoiId="ostfold" title="Østfold live context · frost, wind and field conditions" compact />
      <AgriBoard />
      <CropWatch />
    </div>
  );
}

const WIDGET: Record<string, ComponentType> = {
  earth: EarthSuite, disaster: DisasterSuite, agri: AgriSuite, ocean: OceanSuite, infrastructure: InfraSuite, gnss: GnssGuardian,
  sar: SarSuite, explorer: ExplorerSuite, academy: MissionAcademyPro, human: HumanSuite,  defense: SituationRoom,
};
export default function ModulePage() {
  const { id = '' } = useParams();
  const m = moduleById(id);
  const nav = useNavigate();
  const [proto, setProto] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const assets = useAssets();
  const { db } = useStore();
  if (!m) return <p>Unknown module.</p>;
  const art = assets.modules[m.id];
  const W = WIDGET[m.id];
  const ds = m.datasets.map((d) => DATASETS.find((x) => x.id === d)!).filter(Boolean);
  return (
    <div>
      {/* compact hero: identity on the left, actions on the right, no half-screen banner */}
      <div data-tour="hero" className={`relative mb-3 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${m.gradient}`}>
        {art?.image && <img src={art.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/20" />
        <div className="relative flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/10 backdrop-blur">
              <Icon name={m.icon} className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-[18px] font-semibold leading-tight tracking-tight text-white">{m.name}</h1>
                <Chip>{m.release}</Chip>
                <Chip>{m.state}</Chip>
                {m.patterns.slice(0, 4).map((p) => (
                  <span key={p} className="rounded border border-violet-400/30 px-1 py-[1px] text-[9px] text-violet-200">{PATTERNS[p].short}</span>
                ))}
              </div>
              <p className="mt-0.5 line-clamp-1 max-w-3xl text-[11px] text-slate-300">{m.tagline}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NarrationButton src={art?.audio ?? assets.byKey[m.id]?.audio} label="Narrate" />
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setTour(true)}><Icon name="Compass" className="h-3.5 w-3.5" />Tour</button>
          </div>
        </div>
      </div>

      {/* the same information as before, but as cards you can scan: honesty, live context, how-to */}
      <div data-tour="honesty" className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Glass className="p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-sky-300">
            <Icon name="ShieldCheck" className="h-3.5 w-3.5" />What is real here
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-300">{m.honest}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ds.length ? ds.slice(0, 4).map((d) => (
              <span key={d.id} className="rounded border border-white/10 px-1 py-[1px] text-[8px] text-slate-400">{d.name}</span>
            )) : <span className="text-[8px] text-slate-500">no external dataset connected</span>}
          </div>
        </Glass>

        <Glass className="p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-emerald-300">
              <Icon name="Radio" className="h-3.5 w-3.5" />Live context
            </div>
            <Link to="/data" className="text-[9px] text-sky-400 hover:underline">all sources ↗</Link>
          </div>
          <div className="mt-1">
            {WEATHER_SITES[m.id] ? (
              <WeatherNow {...WEATHER_SITES[m.id]} compact />
            ) : (
              <p className="text-[10px] leading-snug text-slate-400">
                No dedicated feed for this board. The panels below query their own source directly — every figure prints its provider and fetch time underneath.
              </p>
            )}
          </div>
        </Glass>

        <Glass className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-sky-300">
              <Icon name="Sparkles" className="h-3.5 w-3.5" />How to use
            </div>
            <button className="btn-primary !px-2 !py-1 text-[10px]" onClick={() => nav(`/analysis?q=${encodeURIComponent(m.question)}`)}>
              <Icon name="Zap" className="h-3 w-3" />Run demo
            </button>
          </div>
          {GUIDES[m.id] ? (
            <ol className="mt-1 space-y-0.5">
              {GUIDES[m.id].howto.slice(0, 4).map((step, i) => (
                <li key={i} className="flex gap-1 text-[10px] leading-snug text-slate-300">
                  <span className="font-semibold text-sky-300">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-[10px] text-slate-400">Pick a panel below; each one states its source and date under the figures.</p>
          )}
        </Glass>
      </div>

      {STORIES[m.id] && <div data-tour="story"><Suspense fallback={<div className="mb-3 grid h-[400px] place-items-center text-xs text-slate-500">Loading story globe…</div>}><StoryGlobe beats={STORIES[m.id].beats} db={db} types={GUIDES[m.id]?.focus} /></Suspense></div>}
      {m.id === 'earth' && <EarthStory />}
      {m.id === 'sar' && <SarStory />}
      {m.id === 'earth' && <SvalbardLenses />}
      {m.id === 'ocean' && <OceanStory />}
      {m.id === 'explorer' && <ExplorerStory />}
      {m.id === 'academy' && <MissionStory />}
      {m.id === 'human' && <HumanStory />}
      <div data-tour="main"><Suspense fallback={<div role="status" className="grid min-h-48 place-items-center text-sm text-slate-400">Loading module…</div>}><W /></Suspense></div>
      <div data-tour="sources" className="mt-3 grid grid-cols-3 gap-3">
        <Glass className="p-4">
          <div className="h-title mb-2">Kernel patterns reused</div>
          <ul className="space-y-1.5 text-xs">{m.patterns.map((p) => <li key={p}><b className="text-violet-200">{PATTERNS[p].name}</b><div className="text-slate-400">{PATTERNS[p].description}</div></li>)}</ul>
        </Glass>
        <Glass className="p-4">
          <div className="h-title mb-2">Datasets</div>
          {ds.length ? <ul className="space-y-1.5 text-xs">{ds.map((d) => <li key={d.id} className="flex items-start justify-between gap-2"><span><a href={d.url || undefined} target="_blank" rel="noreferrer" className="text-slate-100 hover:text-sky-300">{d.name}</a><div className="text-slate-500">{d.note}</div></span><StatusBadge status={d.status} /></li>)}</ul> : <p className="text-xs text-slate-500">No external dataset connected. Sample data only.</p>}
        </Glass>
        <Glass className="p-4">
          <div className="h-title mb-2">Challenges & prototypes</div>
          {m.challenges.length ? <ul className="space-y-1 text-xs">{m.challenges.map((n) => { const c = CHALLENGES.find((x) => x.n === n)!; return <li key={n} className="flex items-center justify-between"><span className="text-slate-200">#{n} {c.name}</span><button className="text-sky-300 hover:underline" onClick={() => setProto(c.file)}>open prototype</button></li>; })}</ul> : <p className="text-xs text-slate-500">No Space Apps challenge maps here yet (ORBIT sector PRD only).</p>}
          <div className="mt-3 flex flex-wrap gap-1">{m.sdgs.map((n) => <button key={n} onClick={() => nav('/sdgs')} className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: SDGS[n].color }}>SDG {n}</button>)}</div>
        </Glass>
      </div>
      {proto && (
        <Glass className="mt-3 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs"><span className="flex items-center gap-2"><StatusBadge status="sample" />Embedded prototype · {proto}</span><span className="flex gap-3"><a className="text-sky-300" href={`/prototypes/${proto}`} target="_blank" rel="noreferrer">open in tab</a><button onClick={() => setProto(null)}>close</button></span></div>
          <iframe title={proto} src={`/prototypes/${proto}`} className="h-[640px] w-full bg-white" />
        </Glass>
      )}
      {tour && TOURS[m.id] && <GuidedTour steps={TOURS[m.id]} onDone={() => setTour(false)} />}
    </div>
  );
}
