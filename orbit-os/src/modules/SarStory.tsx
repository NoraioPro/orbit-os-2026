import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';
import { FindingsVoice } from '../components/FindingsVoice';

/**
 * SAR Earth Observatory — story mode.
 *
 * The module holds three answering surfaces (catalogue, site intel, fault lab) plus
 * C5. In order they are one argument:
 *   radar is the only all-weather answer → here is what we actually hold → here is a
 *   real pair over a real rupture → here is the rule that makes a pair valid → here is
 *   what we refuse to compute → here is the live catalogue, right now.
 *
 * Figures come from the same files the panels read; the live step queries ASF itself.
 */

interface Granule {
  granule: string; platform: string | null; startTime: string | null; product: string | null;
  beamMode?: string | null; polarization?: string | null; browse?: string | null;
}
interface SarCatalogue {
  generated_at: string;
  aois: { id: string; name: string; lat: number; lon: number; queries: { platform: string; status: string; count: number }[] }[];
  granules: Granule[];
}
interface FaultFile {
  pair: { before: { granule: string; platform: string | null; startTime: string | null; flightDirection: string | null; relativeOrbit: number | null; frame: number | null } | null; after: { granule: string; platform: string | null; startTime: string | null; flightDirection: string | null; relativeOrbit: number | null; frame: number | null } | null };
  quicklooks?: { before: { quicklook?: string | null; startTime?: string | null } | null; after: { quicklook?: string | null; startTime?: string | null } | null };
  aoi?: { lat: number; lon: number; name?: string };
}

interface Step {
  kicker: string; title: string; body: string;
  stats: { label: string; value: string; note?: string }[];
  source: string; to?: string; cta?: string;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const day = (s?: string | null) => (s ? s.slice(0, 10) : '—');

export function SarStory() {
  const [cat, setCat] = useState<SarCatalogue | null>(null);
  const [fault, setFault] = useState<FaultFile | null>(null);
  const [live, setLive] = useState<{ n: number; latest: string | null; at: string } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const get = <T,>(p: string, set: (v: T) => void) =>
      fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(set).catch(() => {});
    void get<SarCatalogue>('/data/domains/sar.json', setCat);
    void get<FaultFile>('/data/domains/sar-fault.json', setFault);
  }, []);

  // the live step: ask ASF what is over Svalbard right now (keyless metadata)
  useEffect(() => {
    let alive = true;
    const url =
      'https://api.daac.asf.alaska.edu/services/search/param?platform=NISAR,SENTINEL-1' +
      '&intersectsWith=POINT(15.65%2078.22)&output=json&maxResults=50';
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: unknown) => {
        if (!alive) return;
        const rows = (Array.isArray(d) && Array.isArray(d[0]) ? d[0] : Array.isArray(d) ? d : []) as Granule[];
        const dates = rows.map((g) => g.startTime).filter(Boolean).sort() as string[];
        setLive({ n: rows.length, latest: dates[dates.length - 1] ?? null, at: new Date().toISOString() });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const steps = useMemo<Step[]>(() => {
    const nisar = cat?.granules.filter((g) => /nisar/i.test(g.platform ?? '')).length ?? 0;
    const s1 = cat?.granules.filter((g) => /^sentinel-1/i.test(g.platform ?? '')).length ?? 0;
    const products = [...new Set((cat?.granules ?? []).map((g) => g.product).filter(Boolean))];
    const b = fault?.pair.before;
    const a = fault?.pair.after;
    const sameTrack = b && a ? b.relativeOrbit === a.relativeOrbit && b.frame === a.frame : false;
    const baseline = b?.startTime && a?.startTime ? Math.round((new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) / 86400000) : null;

    return [
      {
        kicker: 'The question',
        title: 'What changed on the ground — when cloud, smoke and darkness hide it?',
        body:
          'Optical imagery fails exactly when a disaster matters most: at night, under smoke, under cloud. Radar illuminates the ground itself, so the same pass works in either condition. That is why this module exists — and why the honest unit of proof is a pair of scenes, not a single picture.',
        stats: [
          { label: 'Works at night', value: 'yes', note: 'own illumination' },
          { label: 'Through cloud', value: 'yes', note: 'C-band · L-band' },
          { label: 'Needs a pair', value: 'always', note: 'one scene shows no change' },
        ],
        source: 'Mission rationale — Sentinel-1 C-band, NISAR L-band',
      },
      {
        kicker: 'What we actually hold',
        title: cat ? `${cat.granules.length} real granule records: ${nisar} NISAR and ${s1} Sentinel-1` : 'What we actually hold',
        body: cat
          ? `Pulled from the ASF catalogue on ${day(cat.generated_at)} across ${cat.aois.length} areas of interest — Oslo and Svalbard. Products on hand: ${products.join(', ') || '—'}. Metadata is free; the pixel data needs an Earthdata login, which is why nothing here is pretended to be processed.`
          : 'Loading the ASF catalogue…',
        stats: [
          { label: 'Records', value: cat ? String(cat.granules.length) : '—', note: 'real ASF metadata' },
          { label: 'NISAR', value: String(nisar), note: 'GSLC / GCOV / RSLC' },
          { label: 'Sentinel-1', value: String(s1), note: 'SLC / GRD' },
        ],
        source: 'public/data/domains/sar.json · NASA ASF Search API',
        to: '/command',
        cta: 'Open Earthdata Command',
      },
      {
        kicker: 'a real pair',
        title: a && b ? `East Anatolian Fault · ${day(b.startTime)} → ${day(a.startTime)} (${baseline} d baseline)` : 'A real pair',
        body:
          a && b
            ? `${a.platform ?? 'Sentinel-1'} scenes either side of the 6 Feb 2023 M7.8 rupture, both processed the same way. ${a.flightDirection ?? ''} pass, relative orbit ${a.relativeOrbit ?? '—'}, frame ${a.frame ?? '—'}. The two quicklooks are the real thing — and the map next to this panel blinks between them so the change is visible instead of described.`
            : 'Loading the pair from the fault lab…',
        stats: [
          { label: 'Before', value: day(b?.startTime), note: b?.granule?.slice(0, 18) ?? '—' },
          { label: 'After', value: day(a?.startTime), note: a?.granule?.slice(0, 18) ?? '—' },
          { label: 'Baseline', value: baseline ? `${baseline} d` : '—', note: '24 d keeps coherence' },
        ],
        source: 'public/data/domains/sar-fault.json · NASA ASF quicklooks',
        to: '/module/sar',
        cta: 'Blink the pair',
      },
      {
        kicker: 'the rule that makes it valid',
        title: sameTrack ? 'Same track, same frame — otherwise the difference is geometry, not ground' : 'Same track, same frame',
        body:
          'Two scenes from different orbits look different even when nothing moved: the viewing angle changed, so the speckle pattern changed. A usable pair keeps the relative orbit and frame fixed and varies only time. This board checks that and says so, which is worth more than a decorative fringe pattern.',
        stats: [
          { label: 'Relative orbit', value: b && a ? `${b.relativeOrbit ?? '—'} / ${a.relativeOrbit ?? '—'}` : '—', note: 'must match' },
          { label: 'Frame', value: b && a ? `${b.frame ?? '—'} / ${a.frame ?? '—'}` : '—', note: 'must match' },
          { label: 'Verdict', value: sameTrack ? 'comparable' : 'not comparable', note: 'checked on the real records' },
        ],
        source: 'Computed from the two ASF granule records',
      },
      {
        kicker: 'what we refuse',
        title: 'No displacement number until a processor has run',
        body:
          'A millimetre figure needs the SLC pair unwrapped — a job, not a fetch. The download needs an Earthdata login this build does not have, so the panel shows the pair, the gauge and the rule, and states that the deformation field is not computed. A wrong number scores worse than a missing one.',
        stats: [
          { label: 'Displacement', value: 'not computed', note: 'needs SLC + InSAR processor' },
          { label: 'NISAR download', value: 'locked', note: 'Earthdata login required' },
          { label: 'Honest output', value: 'pair + rule', note: 'what is actually verifiable' },
        ],
        source: 'Module honesty notes — SarFaultLab, SarSiteIntel',
      },
      {
        kicker: 'live, right now',
        title: live ? `ASF returns ${live.n} scenes over Svalbard at this moment` : 'Live catalogue check',
        body: live
          ? `${fmt(live.n)} granule records over 78.22°N 15.65°E from NISAR and Sentinel-1, newest pass ${day(live.latest)}. Queried at ${live.at.slice(11, 16)} UTC — the same keyless endpoint the site-intel panel uses when you click a study area.`
          : 'Querying ASF for Svalbard…',
        stats: [
          { label: 'Scenes over Svalbard', value: live ? String(live.n) : '—', note: 'NISAR + Sentinel-1' },
          { label: 'Newest pass', value: live ? day(live.latest) : '—', note: 'UTC' },
          { label: 'Query time', value: live ? live.at.slice(11, 16) + ' UTC' : '—', note: 'this page load' },
        ],
        source: 'https://api.daac.asf.alaska.edu/services/search/param · keyless',
        to: '/arctic',
        cta: 'Open Arctic Watch',
      },
    ];
  }, [cat, fault, live]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];
  const spoken = step ? `${step.title}. ${step.body}` : '';

  if (!open) {
    return (
      <Glass className="mb-3 flex items-center justify-between p-2.5">
        <span className="text-[11px] text-slate-400">SAR story folded away.</span>
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
          <Icon name="Sparkles" className="h-4 w-4 text-teal-300" />
          <span className="text-[12px] font-semibold text-white">SAR Earth Observatory · the story</span>
          <StatusBadge status="live" note={`${steps.length} steps · real records`} />
        </div>
        <div className="flex items-center gap-2">
          <PlayBar count={steps.length} index={film.index} playing={film.playing} onToggle={film.toggle} onPick={film.goto} label="auto" intervalMs={7000} />
          <FindingsVoice text={spoken} label="Read" className="btn-ghost !py-1 text-[10px]" />
          <button className="btn-ghost !py-1 text-[10px]" onClick={() => setOpen(false)}>fold</button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-teal-300">
            <span>step {film.index + 1}/{steps.length}</span>
            <span className="h-px flex-1 bg-gradient-to-r from-teal-400/40 to-transparent" />
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
                <button
                  onClick={() => film.goto(i)}
                  className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition ${i === film.index ? 'bg-teal-500/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <span className={`mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[8px] ${i === film.index ? 'border-teal-300/60 text-teal-200' : 'border-white/15 text-slate-500'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-medium">{s.kicker}</span>
                    <span className="block truncate text-[8px] text-slate-500">{s.source.split('·').pop()?.trim()}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-1">
            <Chip>C5 · Radar Surface Change</Chip>
            <Chip>pair, rule, then proof</Chip>
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default SarStory;
