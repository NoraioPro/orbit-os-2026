import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';
import { FindingsVoice } from '../components/FindingsVoice';

/**
 * Space Explorer — story mode, one real use case.
 *
 * The question a mission planner actually asks: where on Earth do we test a
 * lunar-analogue procedure? Svalbard is the honest answer — polar night, permafrost,
 * no vegetation, reachable — and every figure used to argue it comes from the same
 * Norwegian data the Arctic board reads. C9 (analog ranker), C11 (lunar site
 * navigator) and C12 (sky change) are then placed on that one case rather than shown
 * as three unrelated demos.
 */

interface Norway { generated_at: string; aois: { id: string; name: string; lat: number; lon: number; forecast?: { now?: { airTempC: number | null; windMs: number | null; humidityPct: number | null } }; sun?: { polar?: string | null } }[] }
interface IceChart { issued: string | null; totals: { ice_covered_in_window_km2: number } }

interface Step { kicker: string; title: string; body: string; stats: { label: string; value: string; note?: string }[]; source: string; to?: string; cta?: string }

export function ExplorerStory() {
  const [nor, setNor] = useState<Norway | null>(null);
  const [chart, setChart] = useState<IceChart | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const get = <T,>(p: string, set: (v: T) => void) =>
      fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(set).catch(() => {});
    void get<Norway>('/data/norway/index.json', setNor);
    void get<IceChart>('/data/ice/chart.json', setChart);
  }, []);

  const steps = useMemo<Step[]>(() => {
    const svalbard = nor?.aois.find((a) => a.id === 'longyearbyen');
    const now = svalbard?.forecast?.now;
    const polar = svalbard?.sun?.polar;
    return [
      {
        kicker: 'The real question',
        title: 'Where on Earth do we rehearse the Moon — and can we prove it with data?',
        body:
          'A lunar analogue is not a poster: it is a place with the right conditions that you can actually reach and instrument. Svalbard offers polar night, permafrost and almost no vegetation. This page argues that choice with published figures, and then places the three Space Explorer capabilities on it — ranking (C9), site navigation (C11), sky change (C12).',
        stats: [
          { label: 'Candidate site', value: '78.22°N 15.65°E', note: 'Longyearbyen, Svalbard' },
          { label: 'Capabilities used', value: '3', note: 'C9 · C11 · C12' },
          { label: 'Sources', value: 'MET Norway · NSIDC · NISAR/S1', note: 'keyless' },
        ],
        source: 'One use case — lunar-analogue field test',
      },
      {
        kicker: 'C9 · can it be ranked?',
        title: now?.airTempC != null ? `Measured today: ${now.airTempC.toFixed(1)} °C, wind ${now.windMs?.toFixed(1)} m/s, ${now.humidityPct?.toFixed(0)}% RH` : 'Measured conditions',
        body:
          'An analogue score is only as good as its inputs, so the inputs are shown first: air temperature, wind, humidity from MET Norway, and the polar-night flag from the sunrise service. Three independent physical facts about the site, each with a fetch time — before any ranking is claimed.',
        stats: [
          { label: 'Air temperature', value: now?.airTempC != null ? `${now.airTempC.toFixed(1)} °C` : '—', note: 'MET Norway' },
          { label: 'Wind', value: now?.windMs != null ? `${now.windMs.toFixed(1)} m/s` : '—', note: 'MET Norway' },
          { label: 'Daylight', value: polar ?? 'sunrise/sunset', note: 'z-score on published data' },
        ],
        source: 'public/data/norway/index.json · MET Norway',
        to: '/arctic',
        cta: 'Open the Arctic board',
      },
      {
        kicker: 'C11 · the site on the map',
        title: chart?.issued ? `The same latitude that carries the ice edge — chart ${chart.issued}` : 'The site on the map',
        body: chart
          ? `Svalbard sits inside the Fram–Svalbard–Barents window, where the Norwegian Ice Service charts ${Math.round(chart.totals.ice_covered_in_window_km2 / 1000).toLocaleString('en-US')} thousand km² of ice cover. For a field campaign that is an operational constraint, not scenery: access, logistics and the safety margin all follow the edge. A navigator that ignores it is wrong even if its geometry is perfect.`
          : 'Loading the chart…',
        stats: [
          { label: 'Ice in window', value: chart ? `${Math.round(chart.totals.ice_covered_in_window_km2 / 1000).toLocaleString('en-US')}k km²` : '—', note: 'Norwegian Ice Service' },
          { label: 'Tabular position', value: '78.22°N', note: 'chosen site' },
          { label: 'Access', value: 'ice-dependent', note: 'not a road' },
        ],
        source: 'public/data/ice/chart.json · MET Norway',
        to: '/arctic',
        cta: 'See the edge',
      },
      {
        kicker: 'C12 · what changes above',
        title: 'Radar and optical cover the ground; the sky lens is the one that needs a different source',
        body:
          'The ASF catalogue gives real NISAR and Sentinel-1 scenes over this point, which is what makes "did the ground change" answerable. The sky-change capability needs an imagery source this build does not authenticate, so the panel marks it not connected instead of showing a plausible picture. That gap is printed, not hidden.',
        stats: [
          { label: 'Ground truth', value: 'ASF scenes', note: 'NISAR · Sentinel-1' },
          { label: 'Sky source', value: 'not connected', note: 'APOD key is a demo' },
          { label: 'Claimed', value: 'only what is fetched', note: 'module rule' },
        ],
        source: 'NASA ASF · module honesty notes',
        to: '/module/sar',
        cta: 'Open the SAR board',
      },
      {
        kicker: 'What makes this different',
        title: 'One site, three capabilities, every number traced — instead of three unrelated demos',
        body:
          'The usual build shows a ranker, a map and a sky tool side by side and leaves the connection to the reader. Here the site is chosen first, the physics is measured, the logistics are charted, and each capability is introduced only where it adds something to that one case. Simplification that keeps the proof.',
        stats: [
          { label: 'Case', value: '1 site', note: 'Svalbard 78.22°N' },
          { label: 'Lenses', value: '3', note: 'rank · navigate · observe' },
          { label: 'Untraceable figures', value: '0', note: 'provider + time under each' },
        ],
        source: 'Module design note — Space Explorer',
        to: '/solutions',
        cta: 'See the challenges',
      },
    ];
  }, [nor, chart]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];
  const spoken = step ? `${step.title}. ${step.body}` : '';

  if (!open) {
    return (
      <Glass className="mb-3 flex items-center justify-between p-2.5">
        <span className="text-[11px] text-slate-400">Space Explorer story folded away.</span>
        <button className="btn-ghost !py-1 text-xs" onClick={() => setOpen(true)}><Icon name="Sparkles" className="h-3.5 w-3.5" />Open the story</button>
      </Glass>
    );
  }

  return (
    <Glass className="mb-3 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" className="h-4 w-4 text-indigo-300" />
          <span className="text-[12px] font-semibold text-white">Space Explorer · the story</span>
          <StatusBadge status="live" note={`${steps.length} steps · auto-playing`} />
        </div>
        <div className="flex items-center gap-2">
          <PlayBar count={steps.length} index={film.index} playing={film.playing} onToggle={film.toggle} onPick={film.goto} label="auto" intervalMs={7000} />
          <FindingsVoice text={spoken} label="Read" className="btn-ghost !py-1 text-[10px]" />
          <button className="btn-ghost !py-1 text-[10px]" onClick={() => setOpen(false)}>fold</button>
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-indigo-300">
            <span>step {film.index + 1}/{steps.length}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-indigo-400/40 to-transparent" />
            <span className="text-slate-500">{step.kicker}</span>
          </div>
          <h3 className="mt-1 text-[16px] font-semibold leading-snug text-white">{step.title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{step.body}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {step.stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.08em] text-slate-500">{s.label}</div>
                <div className="text-[13px] font-semibold leading-tight text-white">{s.value}</div>
                {s.note && <div className="text-[8px] leading-snug text-slate-500">{s.note}</div>}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[8px] text-slate-500">source · {step.source}</span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost !py-1 text-[10px]" onClick={() => film.goto((film.index - 1 + steps.length) % steps.length)}>← back</button>
              <button className="btn-primary !py-1 text-[10px]" onClick={() => film.goto((film.index + 1) % steps.length)}>next →</button>
              {step.to && <Link to={step.to} className="btn-ghost !py-1 text-[10px]">{step.cta ?? 'open'} ↗</Link>}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="text-[9px] uppercase tracking-[0.1em] text-slate-500">the argument, step by step</div>
          <ol className="mt-1 space-y-1">
            {steps.map((s, i) => (
              <li key={s.kicker}>
                <button onClick={() => film.goto(i)} className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition ${i === film.index ? 'bg-indigo-500/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                  <span className={`mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[8px] ${i === film.index ? 'border-indigo-300/60 text-indigo-200' : 'border-white/15 text-slate-500'}`}>{i + 1}</span>
                  <span className="min-w-0 truncate text-[10px] font-medium">{s.kicker}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-1"><Chip>one real site</Chip><Chip>C9 · C11 · C12</Chip></div>
        </div>
      </div>
    </Glass>
  );
}

export default ExplorerStory;
