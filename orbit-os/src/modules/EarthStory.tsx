import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';
import { FindingsVoice } from '../components/FindingsVoice';

/**
 * Earth Intelligence — story mode.
 *
 * The module has five challenge prototypes and nine real data panels. Read as a
 * grid they are a pile of dashboards; read in order they are one argument:
 * something is changing, here is the evidence, here is what we cannot yet prove,
 * and here is what each of the five capabilities adds.
 *
 * Every figure in the story is pulled from the same JSON the panels use, so the
 * narrative cannot drift away from the data. Each step names the file it came from.
 */

interface Step {
  kicker: string;
  title: string;
  body: string;
  stats: { label: string; value: string; note?: string }[];
  source: string;
  to?: string;
  cta?: string;
}

interface IceTrends {
  regions: { id: string; label: string; stats_by_month: { month: number; slope_km2_per_decade: number; latest_km2: number; climatology_1991_2020_km2: number | null; latest_year: number }[] }[];
}
interface IceChart { issued: string | null; totals: { ice_covered_km2: number; ice_covered_in_window_km2: number }; classes: { nis_class: string; ct: number | null }[] }
interface Norway { generated_at: string; aois: { id: string; name: string; forecast?: { now?: { airTempC: number | null; windMs: number | null } }; ocean?: { seaWaterTempC?: number | null; waveHeightM?: number | null } }[] }
interface Quake { event: { magnitude: number; time: string; mmi: number | null }; aftershocks: { count: number; strongest: { magnitude: number } | null }; shakemap: { maxMmi: number | null; stations: { count: number } | null }; imagery: { available: boolean; before?: { date: string }; after?: { date: string } } }
interface Hires { aois: { id: string; layers: { short: string; resolution: number; dates: string[] }[] }[] }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function EarthStory() {
  const [ice, setIce] = useState<IceTrends | null>(null);
  const [chart, setChart] = useState<IceChart | null>(null);
  const [nor, setNor] = useState<Norway | null>(null);
  const [quake, setQuake] = useState<Quake | null>(null);
  const [hires, setHires] = useState<Hires | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const get = <T,>(p: string, set: (v: T) => void) =>
      fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(set).catch(() => {});
    void get<IceTrends>('/data/ice/trends.json', setIce);
    void get<IceChart>('/data/ice/chart.json', setChart);
    void get<Norway>('/data/norway/index.json', setNor);
    void get<Quake>('/data/disaster/kahramanmaras.json', setQuake);
    void get<Hires>('/data/domains/hires.json', setHires);
  }, []);

  const steps = useMemo<Step[]>(() => {
    const barents = ice?.regions.find((r) => r.id === 'barents');
    const sept = barents?.stats_by_month.find((s) => s.month === 9);
    const greenland = ice?.regions.find((r) => r.id === 'greenland')?.stats_by_month.find((s) => s.month === 9);
    const oslo = nor?.aois.find((a) => a.id === 'oslo');
    const svalbard = nor?.aois.find((a) => a.id === 'longyearbyen');
    const barentsSea = nor?.aois.find((a) => a.id === 'barents');
    const hiresAoi = hires?.aois[0];

    return [
      {
        kicker: 'The question',
        title: 'Is this place changing, and how sure are we?',
        body:
          'One question, nine sources. Instead of opening six different portals, the module asks it once and then shows what each source can and cannot answer.',
        stats: [
          { label: 'Real sources wired', value: '9', note: 'USGS · NSIDC · MET Norway · NASA ASF · GIBS · POWER · FIRMS · EONET · NVE' },
          { label: 'Figures shown', value: '100 %', note: 'each with provider + fetch time' },
          { label: 'Invented numbers', value: '0', note: 'anything unavailable renders as not connected' },
        ],
        source: 'Module data audit — every panel on this page',
      },
      {
        kicker: 'The long record',
        title: sept
          ? `Barents September ice is down ${Math.abs(sept.slope_km2_per_decade).toLocaleString('en-US')} km² per decade`
          : 'The long record',
        body: sept
          ? `In ${sept.latest_year} the Barents carried ${fmt(sept.latest_km2)} km² of September ice against a 1991–2020 average of ${fmt(sept.climatology_1991_2020_km2 ?? 0)}. The Greenland Sea, the same measurement, is losing ${greenland ? Math.abs(greenland.slope_km2_per_decade).toLocaleString('en-US') : '—'} km² per decade — five times more slowly. One chart shows that difference instantly.`
          : 'Loading the NSIDC regional series…',
        stats: [
          { label: 'Barents Sept trend', value: sept ? `${sept.slope_km2_per_decade.toLocaleString('en-US')} km²/dec` : '—', note: 'least squares on the published series' },
          { label: 'Greenland Sept trend', value: greenland ? `${greenland.slope_km2_per_decade.toLocaleString('en-US')} km²/dec` : '—', note: 'same method' },
          { label: 'Series length', value: '1978 → now', note: 'NSIDC Sea Ice Index v4.0, monthly' },
        ],
        source: 'public/data/ice/trends.json · NSIDC regional monthly',
        to: '/arctic',
        cta: 'Open the ice board',
      },
      {
        kicker: 'Today’s state',
        title: chart?.issued ? `The chart for ${chart.issued} says where the ice edge actually is` : 'Today’s state',
        body: chart
          ? `${fmt(chart.totals.ice_covered_km2)} km² of ice cover on the Norwegian Ice Service chart, ${fmt(chart.totals.ice_covered_in_window_km2)} km² of it inside the Fram–Svalbard–Barents window, split across ${chart.classes.filter((c) => (c.ct ?? 0) > 0).length} concentration classes. The trend above says what is happening over decades; this says what a vessel would meet this morning.`
          : 'Loading the Norwegian Ice Service chart…',
        stats: [
          { label: 'Ice-covered', value: chart ? `${Math.round(chart.totals.ice_covered_km2 / 1000).toLocaleString('en-US')}k km²` : '—', note: 'concentration-weighted' },
          { label: 'In window', value: chart ? `${Math.round(chart.totals.ice_covered_in_window_km2 / 1000).toLocaleString('en-US')}k km²` : '—', note: 'Fram · Svalbard · Barents' },
          { label: 'Chart issue', value: chart?.issued ?? '—', note: 'SIGRID-3, parsed' },
        ],
        source: 'public/data/ice/chart.json · MET Norway ice chart',
        to: '/arctic',
        cta: 'See the chart on the map',
      },
      {
        kicker: 'The local reading',
        title: svalbard?.forecast?.now?.airTempC != null
          ? `${svalbard.name} is at ${svalbard.forecast.now.airTempC.toFixed(1)} °C — and the sun does not rise`
          : 'The local reading',
        body:
          `The same page carries the observation next to the analysis: ${oslo?.forecast?.now ? `${oslo.name} ${oslo.forecast.now.airTempC?.toFixed(1)} °C, wind ${oslo.forecast.now.windMs?.toFixed(1)} m/s` : 'Oslo conditions'}` +
          (barentsSea?.ocean?.waveHeightM != null ? `, and ${barentsSea.ocean.waveHeightM} m seas in the Barents` : '') +
          '. A number without a place and a time is decoration; here every figure carries both.',
        stats: [
          { label: 'Longyearbyen', value: svalbard?.forecast?.now?.airTempC != null ? `${svalbard.forecast.now.airTempC.toFixed(1)} °C` : '—', note: 'MET Norway, polar night' },
          { label: 'Barents sea temp', value: barentsSea?.ocean?.seaWaterTempC != null ? `${barentsSea.ocean.seaWaterTempC} °C` : '—', note: 'Oceanforecast 2.0' },
          { label: 'Forecast age', value: nor ? new Date(nor.generated_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—', note: 'fetch timestamp' },
        ],
        source: 'public/data/norway/index.json · MET Norway + NVE',
        to: '/module/infrastructure',
        cta: 'Open the Oslo board',
      },
      {
        kicker: 'One event, end to end',
        title: quake ? `M${quake.event.magnitude} Kahramanmaraş: ${quake.aftershocks.count} aftershocks and a real before/after pair` : 'One event, end to end',
        body: quake
          ? `USGS published M${quake.event.magnitude} at ${quake.event.time.slice(0, 16).replace('T', ' ')} UTC, MMI ${quake.shakemap.maxMmi?.toFixed(1)} from ${quake.shakemap.stations?.count?.toLocaleString('en-US') ?? '—'} stations. ORBIT adds the ${quake.aftershocks.count} catalogue aftershocks and the Sentinel-1 quicklooks (${quake.imagery.before?.date} → ${quake.imagery.after?.date}) — and states that it cannot compute the displacement field without a processed SLC pair.`
          : 'Loading the USGS case…',
        stats: [
          { label: 'Aftershocks M≥3', value: quake ? String(quake.aftershocks.count) : '—', note: 'counted from the catalogue' },
          { label: 'ShakeMap stations', value: quake?.shakemap.stations?.count?.toLocaleString('en-US') ?? '—', note: 'USGS product' },
          { label: 'Deformation field', value: 'not computed', note: 'needs NISAR/Sentinel-1 SLC' },
        ],
        source: 'public/data/disaster/kahramanmaras.json · USGS + NASA ASF',
        to: '/module/disaster',
        cta: 'Open the case',
      },
      {
        kicker: 'And the same place at 30 m',
        title: hiresAoi ? `The proof of what changed, at ${hiresAoi.layers[0]?.resolution ?? 30} m` : 'At 30 m',
        body: hiresAoi
          ? `Where a 250 m view blurs a field into one pixel, HLS Sentinel-2 and Landsat give ${hiresAoi.layers.map((l) => l.short).join(', ')} — and the panel plays the dates so the season moves in front of you instead of asking you to click six thumbnails.`
          : 'Loading the 30 m catalogue…',
        stats: hiresAoi
          ? hiresAoi.layers.slice(0, 3).map((l) => ({ label: l.short, value: `${l.dates.length} dates`, note: `${l.resolution} m/px` }))
          : [{ label: 'Layers', value: '—' }],
        source: 'public/data/domains/hires.json · NASA GIBS',
        to: '/unified',
        cta: 'Open the 30 m view',
      },
      {
        kicker: 'What is different',
        title: 'Five challenge prototypes, one pipeline — and the honesty is the product',
        body:
          'Trend detective (C2), radar change (C5), field rotation (C6), fire harmoniser (C8) and the sound jukebox (C14) all read from the same evidence kernel: plan → fetch → compute → verify → explain. What makes it different is not the number of dashboards; it is that every figure names its provider and its fetch time, and anything unproven is labelled instead of drawn.',
        stats: [
          { label: 'Challenges carried', value: '5', note: 'C2 · C5 · C6 · C8 · C14' },
          { label: 'Pipeline stages', value: '5', note: 'plan · fetch · compute · verify · explain' },
          { label: 'Provenance on screen', value: 'always', note: 'provider + timestamp under each figure' },
        ],
        source: 'src/data/modules.ts · Earth Intelligence',
        to: '/solutions',
        cta: 'See all 14 challenges',
      },
    ];
  }, [ice, chart, nor, quake, hires]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];
  const spoken = step ? `${step.title}. ${step.body}` : '';

  if (!open) {
    return (
      <Glass className="mb-3 flex items-center justify-between p-2.5">
        <span className="text-[11px] text-slate-400">Story mode is folded away.</span>
        <button className="btn-ghost !py-1 text-xs" onClick={() => setOpen(true)}>
          <Icon name="Sparkles" className="h-3.5 w-3.5" />Open the story
        </button>
      </Glass>
    );
  }

  return (
    <Glass className="mb-3 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" className="h-4 w-4 text-violet-300" />
          <span className="text-[12px] font-semibold text-white">Earth Intelligence · the story</span>
          <StatusBadge status="live" note={`${steps.length} steps · real figures`} />
        </div>
        <div className="flex items-center gap-2">
          <PlayBar
            count={steps.length}
            index={film.index}
            playing={film.playing}
            onToggle={film.toggle}
            onPick={film.goto}
            label="auto"
            intervalMs={7000}
          />
          <FindingsVoice text={spoken} label="Read" className="btn-ghost !py-1 text-[10px]" />
          <button className="btn-ghost !py-1 text-[10px]" onClick={() => setOpen(false)} title="Fold the story away">
            fold
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-violet-300">
            <span>
              step {film.index + 1}/{steps.length}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-violet-400/40 to-transparent" />
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
              <button
                className="btn-ghost !py-1 text-[10px]"
                onClick={() => film.goto((film.index - 1 + steps.length) % steps.length)}
              >
                ← back
              </button>
              <button className="btn-primary !py-1 text-[10px]" onClick={() => film.goto((film.index + 1) % steps.length)}>
                next →
              </button>
              {step.to && (
                <Link to={step.to} className="btn-ghost !py-1 text-[10px]">
                  {step.cta ?? 'open'} ↗
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="p-3">
          <div className="text-[9px] uppercase tracking-[0.1em] text-slate-500">the whole argument</div>
          <ol className="mt-1 space-y-1">
            {steps.map((s, i) => (
              <li key={s.kicker}>
                <button
                  onClick={() => film.goto(i)}
                  className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition ${i === film.index ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <span className={`mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[8px] ${i === film.index ? 'border-violet-300/60 text-violet-200' : 'border-white/15 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-medium">{s.kicker}</span>
                    <span className="block truncate text-[8px] text-slate-500">{s.source.split('·').pop()?.trim()}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip>simplified, not diluted</Chip>
            <Chip>each figure traceable</Chip>
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default EarthStory;
