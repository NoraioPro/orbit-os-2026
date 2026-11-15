import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';

/**
 * Mission Academy — story mode, one design case.
 * C13 (mission design), C3 (outpost trainer), C1 (retired hardware).
 * The environment the outpost must survive is a live MET Norway observation; the one
 * capability the build cannot source (C1 hardware archive) is labelled, not invented.
 */

interface Norway { aois: { id: string; name: string; forecast?: { now?: { airTempC: number | null; windMs: number | null; humidityPct: number | null } }; sun?: { polar?: string | null } }[] }

export function MissionStory() {
  const [nor, setNor] = useState<Norway | null>(null);
  useEffect(() => {
    fetch('/data/norway/index.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(setNor).catch(() => {});
  }, []);

  const steps = useMemo(() => {
    const s = nor?.aois.find((a) => a.id === 'longyearbyen');
    const now = s?.forecast?.now;
    const polar = s?.sun?.polar;
    return [
      {
        k: 'The design case',
        t: 'A Mars outpost is an energy problem before it is a habitat problem',
        b: 'Every subsystem is priced in power and mass, so the first question is how much energy the environment gives and takes. This page runs that one case through C13, C3 and C1 — with the environment taken from a measured high-latitude observation rather than invented.',
        s: [['Design driver', 'power + mass'], ['Capabilities', 'C13 · C3 · C1'], ['Invented inputs', '0']],
        src: 'One case — Mars outpost, energy first',
      },
      {
        k: 'C3 · the environment',
        t: now?.airTempC != null ? `Measured analog: ${now.airTempC.toFixed(1)} °C, ${now.windMs?.toFixed(1)} m/s wind, ${now.humidityPct?.toFixed(0)}% RH` : 'The environment it must survive',
        b: 'A trainer needs an environment; the honest way to seed one is with a measured one. MET Norway reports temperature, wind and humidity at 78.22°N, and the sunrise service confirms polar night — so the model starts from cold, wind and zero solar input.',
        s: [['Temperature', now?.airTempC != null ? `${now.airTempC.toFixed(1)} °C` : '—'], ['Wind', now?.windMs != null ? `${now.windMs.toFixed(1)} m/s` : '—'], ['Daylight', polar ?? 'rise/set']],
        src: 'public/data/norway/index.json · MET Norway',
        to: '/arctic',
        cta: 'Arctic board',
      },
      {
        k: 'C13 · the budget',
        t: 'With no sunlight for months, storage and a constant source set the mass',
        b: 'Once the daylight term is zero, the design closes on stored energy plus a constant source — why surface-power studies converge on fission or large arrays with batteries. The game shows the trade; the rule is that a trade is only shown against measured inputs, and no mission number is claimed as data.',
        s: [['Solar input', polar ? '0 (polar night)' : 'diurnal'], ['Priority', 'power → thermal'], ['Status', 'method only']],
        src: 'Design method — sourced vs constant inputs stated apart',
        to: '/solutions',
        cta: 'Open C13',
      },
      {
        k: 'C1 · the missing archive',
        t: 'The retired-hardware stories are what this build cannot source',
        b: 'C1 needs a curated archive of mission records to tell hardware history properly. This build carries none, so the capability is marked not connected instead of illustrated with invented mission facts — the same discipline applied to every number on the platform.',
        s: [['Hardware archive', 'not connected'], ['Environment data', 'live'], ['Claimed history', 'none']],
        src: 'Module honesty notes — Mission Academy',
      },
      {
        k: 'Why it is different',
        t: 'One case, three capabilities, measured inputs, gaps left visible',
        b: 'A mission game is easy to fake with numbers that make a satisfying loop. Here the environment carries a timestamp, the power argument follows from the observed daylight term, and the capability without a source is labelled. Simplification that keeps the proof intact.',
        s: [['Case', '1 outpost'], ['Measured inputs', '4'], ['Untraceable figures', '0']],
        src: 'Module design note — Mission Academy',
        to: '/solutions',
        cta: 'All challenges',
      },
    ];
  }, [nor]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];

  return (
    <Glass className="mb-3 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" className="h-4 w-4 text-amber-300" />
          <span className="text-[12px] font-semibold text-white">Mission Academy · the story</span>
          <StatusBadge status="live" note={`${steps.length} steps · auto-playing`} />
        </div>
        <PlayBar count={steps.length} index={film.index} playing={film.playing} onToggle={film.toggle} onPick={film.goto} label="auto" intervalMs={7000} />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-amber-300">
          <span>step {film.index + 1}/{steps.length}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-amber-400/40 to-transparent" />
          <span className="text-slate-500">{step.k}</span>
        </div>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug text-white">{step.t}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{step.b}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {step.s.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.08em] text-slate-500">{label}</div>
              <div className="text-[13px] font-semibold leading-tight text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[8px] text-slate-500">source · {step.src}</span>
          <div className="flex items-center gap-1">
            <button className="btn-ghost !py-1 text-[10px]" onClick={() => film.goto((film.index - 1 + steps.length) % steps.length)}>← back</button>
            <button className="btn-primary !py-1 text-[10px]" onClick={() => film.goto((film.index + 1) % steps.length)}>next →</button>
            {'to' in step && step.to && <Link to={step.to} className="btn-ghost !py-1 text-[10px]">{step.cta ?? 'open'} ↗</Link>}
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default MissionStory;
