import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';
import { FindingsVoice } from '../components/FindingsVoice';

/**
 * Ocean Intelligence — story mode, told for a Norwegian audience.
 *
 * The Norwegian Sea and the Barents are where the sea ice retreat, the fisheries and
 * the northbound traffic meet, so that is the case: one water body, one argument, all
 * figures from the files the panels already read (MET Norway, NSIDC, Norwegian Ice
 * Service). The sequence plays itself; any click stops on a step.
 */

interface Trends { regions: { id: string; label: string; stats_by_month: { month: number; slope_km2_per_decade: number; latest_km2: number; latest_year: number; climatology_1991_2020_km2: number | null }[] }[] }
interface Chart { issued: string | null; totals: { ice_covered_km2: number; ice_covered_in_window_km2: number } }
interface Norway { generated_at: string; aois: { id: string; name: string; forecast?: { now?: { airTempC: number | null; windMs: number | null } }; ocean?: { seaWaterTempC?: number | null; waveHeightM?: number | null; currentSpeedMs?: number | null }; flood_warnings?: { count?: number }; landslide_warnings?: { count?: number } }[] }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

interface Step { kicker: string; title: string; body: string; stats: { label: string; value: string; note?: string }[]; source: string; to?: string; cta?: string }

export function OceanStory() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [nor, setNor] = useState<Norway | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const get = <T,>(p: string, set: (v: T) => void) =>
      fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(set).catch(() => {});
    void get<Trends>('/data/ice/trends.json', setTrends);
    void get<Chart>('/data/ice/chart.json', setChart);
    void get<Norway>('/data/norway/index.json', setNor);
  }, []);

  const steps = useMemo<Step[]>(() => {
    const barents = trends?.regions.find((r) => r.id === 'barents');
    const greenland = trends?.regions.find((r) => r.id === 'greenland');
    const sept = barents?.stats_by_month.find((s) => s.month === 9);
    const gSept = greenland?.stats_by_month.find((s) => s.month === 9);
    const sea = nor?.aois.find((a) => a.id === 'barents');
    const svalbard = nor?.aois.find((a) => a.id === 'longyearbyen');
    const o = sea?.ocean;

    return [
      {
        kicker: 'Why this water matters to Norway',
        title: 'Two seas carry the fish, the traffic and the ice — and they are not changing at the same speed',
        body:
          'The Barents and the Greenland Sea sit against the same coastline and feed the same fisheries, but they respond to a warming Arctic very differently. Reading them as one "Arctic" number hides that. This page keeps them apart and puts the sea state next to the decade-long record.',
        stats: [
          { label: 'Regions kept separate', value: '3', note: 'Barents · Greenland · Kara' },
          { label: 'Record', value: '1978 → now', note: 'NSIDC regional monthly' },
          { label: 'Today’s state', value: 'MET Norway', note: 'Oceanforecast 2.0' },
        ],
        source: 'NSIDC Sea Ice Index v4.0 + MET Norway Oceanforecast',
      },
      {
        kicker: 'The long retreat',
        title: sept ? `Barents September ice: ${fmt(sept.latest_km2)} km² in ${sept.latest_year}, ${Math.abs(sept.slope_km2_per_decade).toLocaleString('en-US')} km² lost per decade` : 'The long retreat',
        body: sept
          ? `Against a 1991–2020 September average of ${fmt(sept.climatology_1991_2020_km2 ?? 0)} km². The Greenland Sea, measured the same way, is losing ${gSept ? Math.abs(gSept.slope_km2_per_decade).toLocaleString('en-US') : '—'} km² per decade — slower, and still open water for longer. For a fisher or a skipper the useful form of that sentence is: the southern limit of ice keeps moving north.`
          : 'Loading the NSIDC series…',
        stats: [
          { label: 'Barents trend', value: sept ? `${sept.slope_km2_per_decade.toLocaleString('en-US')} km²/dec` : '—', note: 'September' },
          { label: 'Greenland trend', value: gSept ? `${gSept.slope_km2_per_decade.toLocaleString('en-US')} km²/dec` : '—', note: 'September' },
          { label: 'Climatology', value: sept ? `${fmt(sept.climatology_1991_2020_km2 ?? 0)} km²` : '—', note: '1991–2020' },
        ],
        source: 'public/data/ice/trends.json · NSIDC v4.0',
        to: '/arctic',
        cta: 'Open the ice board',
      },
      {
        kicker: 'Where the edge is today',
        title: chart?.issued ? `Chart ${chart.issued}: ${fmt(chart.totals.ice_covered_in_window_km2)} km² of ice inside the Fram–Svalbard–Barents window` : 'Where the edge is today',
        body: chart
          ? `The Norwegian Ice Service chart puts ${fmt(chart.totals.ice_covered_km2)} km² of ice cover across the Arctic, of which ${fmt(chart.totals.ice_covered_in_window_km2)} km² lies in the waters a Norwegian vessel would actually cross. The decade-long trend says where it is going; this says what a skipper meets tonight.`
          : 'Loading the Norwegian Ice Service chart…',
        stats: [
          { label: 'In window', value: chart ? `${Math.round(chart.totals.ice_covered_in_window_km2 / 1000).toLocaleString('en-US')}k km²` : '—', note: 'Fram · Svalbard · Barents' },
          { label: 'Whole chart', value: chart ? `${Math.round(chart.totals.ice_covered_km2 / 1000).toLocaleString('en-US')}k km²` : '—', note: 'concentration-weighted' },
          { label: 'Issued', value: chart?.issued ?? '—', note: 'SIGRID-3' },
        ],
        source: 'public/data/ice/chart.json · MET Norway',
        to: '/arctic',
        cta: 'See the edge',
      },
      {
        kicker: 'Sea state, now',
        title: o?.waveHeightM != null ? `${o.waveHeightM} m seas, ${o.seaWaterTempC} °C water in the Barents` : 'Sea state, now',
        body:
          `The forecast for 76.5°N 20°E: wave height ${o?.waveHeightM ?? '—'} m, sea-water temperature ${o?.seaWaterTempC ?? '—'} °C, current ${o?.currentSpeedMs ?? '—'} m/s. Air at Longyearbyen ${svalbard?.forecast?.now?.airTempC?.toFixed(1) ?? '—'} °C with ${svalbard?.forecast?.now?.windMs?.toFixed(1) ?? '—'} m/s wind. Sea temperature next to the ice margin is the number that decides how fast that margin retreats.`,
        stats: [
          { label: 'Wave height', value: o?.waveHeightM != null ? `${o.waveHeightM} m` : '—', note: 'Oceanforecast 2.0' },
          { label: 'Sea temperature', value: o?.seaWaterTempC != null ? `${o.seaWaterTempC} °C` : '—', note: 'not air temperature' },
          { label: 'Current', value: o?.currentSpeedMs != null ? `${o.currentSpeedMs} m/s` : '—', note: 'surface' },
        ],
        source: 'public/data/norway/index.json · MET Norway',
        to: '/module/ocean',
        cta: 'Open the ocean board',
      },
      {
        kicker: 'What that means for a boat',
        title: 'No NVE warnings, but the operational answer is still the ice edge, not the wave height',
        body:
          `Flood warnings ${sea?.flood_warnings?.count ?? '—'}, landslide warnings ${sea?.landslide_warnings?.count ?? '—'} for this region — an empty list is a real answer, not a missing fetch. Practically: ${o?.waveHeightM != null && o.waveHeightM > 3 ? 'a 3 m-plus swell rules out small craft' : 'the swell is workable'} while the constraint that actually stops a northbound route is the charted ice edge in the step above.`,
        stats: [
          { label: 'Flood warnings', value: String(sea?.flood_warnings?.count ?? '—'), note: 'NVE, issued list' },
          { label: 'Landslide warnings', value: String(sea?.landslide_warnings?.count ?? '—'), note: 'NVE, issued list' },
          { label: 'Decisive factor', value: 'ice edge', note: 'not the swell' },
        ],
        source: 'NVE warning API + MET Norway sea state',
      },
      {
        kicker: 'What we will not claim',
        title: 'No ocean-colour trend, no ice thickness, no seasonal forecast',
        body:
          'Chlorophyll and ocean colour need a PACE/MODIS product this build does not authenticate, so the panel says "not connected" instead of drawing a green plume. The ice chart gives extent and concentration class, never thickness. NSIDC gives the history, not a prediction. The three numbers that could mislead a skipper are the three we refuse to invent.',
        stats: [
          { label: 'Ocean colour', value: 'not connected', note: 'PACE/MODIS' },
          { label: 'Ice thickness', value: 'not available', note: 'chart gives extent + class' },
          { label: 'Seasonal forecast', value: 'not offered', note: 'history only' },
        ],
        source: 'Module honesty notes — Ocean Intelligence',
      },
    ];
  }, [trends, chart, nor]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];
  const spoken = step ? `${step.title}. ${step.body}` : '';

  if (!open) {
    return (
      <Glass className="mb-3 flex items-center justify-between p-2.5">
        <span className="text-[11px] text-slate-400">Ocean story folded away.</span>
        <button className="btn-ghost !py-1 text-xs" onClick={() => setOpen(true)}><Icon name="Sparkles" className="h-3.5 w-3.5" />Open the story</button>
      </Glass>
    );
  }

  return (
    <Glass className="mb-3 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name="Waves" className="h-4 w-4 text-cyan-300" />
          <span className="text-[12px] font-semibold text-white">Ocean Intelligence · the story</span>
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
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-cyan-300">
            <span>step {film.index + 1}/{steps.length}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/40 to-transparent" />
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
                <button onClick={() => film.goto(i)} className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition ${i === film.index ? 'bg-cyan-500/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                  <span className={`mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[8px] ${i === film.index ? 'border-cyan-300/60 text-cyan-200' : 'border-white/15 text-slate-500'}`}>{i + 1}</span>
                  <span className="min-w-0"><span className="block truncate text-[10px] font-medium">{s.kicker}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-1"><Chip>Norwegian seas</Chip><Chip>real figures only</Chip></div>
        </div>
      </div>
    </Glass>
  );
}

export default OceanStory;
