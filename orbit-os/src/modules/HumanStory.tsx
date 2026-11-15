import { useEffect, useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';

/**
 * ASTRA TWIN — the Human Space Lab demo, built to the Global Award format: six slides
 * that play in about 30 seconds. Three perspectives (human, spacesuit, mission), one
 * connected system, and an explicit line between observation, simulation and inference.
 */
interface Norway { aois: { id: string; name: string; forecast?: { now?: { airTempC: number | null; windMs: number | null } }; sun?: { polar?: string | null } }[] }

export function HumanStory() {
  const [nor, setNor] = useState<Norway | null>(null);
  useEffect(() => {
    fetch('/data/norway/index.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(setNor).catch(() => {});
  }, []);

  const steps = useMemo(() => {
    const s = nor?.aois.find((a) => a.id === 'longyearbyen');
    const now = s?.forecast?.now;
    return [
      {
        k: '1 · The problem',
        t: 'Extend a mission and health monitoring stops being a dashboard',
        b: 'Radiation, altered gravity, isolation and a delay in medical help mean an astronaut cannot rely on a call home. Most interfaces show measurements one at a time; the risk is in the relationship between them. ASTRA TWIN reads the astronaut, the suit and the mission as one connected system.',
        s: [['Perspectives', '3 connected'], ['Hazards', 'NASA HRP · 5'], ['Standard', 'NASA-STD-3001']],
        src: 'Challenge brief — astronaut health beyond Earth',
      },
      {
        k: '2 · Human twin',
        t: 'Physiology with a reason to be watched — not an animated pulse',
        b: 'Cardiovascular measurements, temperature, fatigue, sleep and a psychological self-assessment share one timeline with everything else. In this build the physiology feed is not connected, so the panel shows the architecture and says so, rather than inventing a heart rate that looks convincing.',
        s: [['Physiology feed', 'not connected'], ['Architecture', 'real'], ['Invented vitals', '0']],
        src: 'Module honesty notes — C4',
      },
      {
        k: '3 · Suit twin',
        t: 'The EVA assembly is a real 3D artifact you can open layer by layer',
        b: 'Helmet, visor, life-support backpack, torso, arms, gloves, hips, knees, boots — the model below can be exploded and inspected, so a reviewer sees where oxygen, CO₂ removal, thermal control and power actually live before any warning is explained.',
        s: [['Layers', '9'], ['Status', 'interactive'], ['Claim', 'assembly only']],
        src: 'components/EvaLab.tsx — the model below',
      },
      {
        k: '4 · Mission twin',
        t: 'The environment the system must survive is a measured one',
        b: 'MET Norway reports air temperature, wind and humidity at 78.22°N, and the sunrise service confirms polar night — real numbers with a timestamp that stand in for the mission environment, so the thermal and power load is sourced instead of assumed.',
        s: [['Temperature', now?.airTempC != null ? `${now.airTempC.toFixed(1)} °C` : '—'], ['Wind', now?.windMs != null ? `${now.windMs.toFixed(1)} m/s` : '—'], ['Daylight', s?.sun?.polar ?? 'rise/set']],
        src: 'public/data/norway/index.json · MET Norway',
      },
      {
        k: '5 · The scenario',
        t: 'CO₂ scrubber degrades: suit, crew and procedure move on one timeline',
        b: 'The demonstration scenario is a simulated degradation of CO₂ removal. As suit CO₂ rises, the linked physiological observations change with it, the affected equipment is highlighted in the 3D assembly, and the response procedure opens beside it — the same chain a flight surgeon would walk, on one screen.',
        s: [['Scenario', 'simulated'], ['Linked views', 'suit · crew · procedure'], ['Labelled', 'simulation, not telemetry']],
        src: 'Design scenario — observation vs simulation vs inference',
      },
      {
        k: '6 · What is different',
        t: 'One astronaut, one spacesuit, one connected system — with the evidence kept honest',
        b: 'The innovation is the link between physical equipment and human physiology: the suit is not decoration and the astronaut is not a chart. Every real figure carries its provider, every simulated value is named as such, and the claim stops where the data stops.',
        s: [['Real artifacts', '3D suit · live environment'], ['Synthetic physiology', '0'], ['Traceable', 'always']],
        src: 'ASTRA TWIN — submission statement',
      },
    ];
  }, [nor]);

  const film = useAutoPlay(steps.length, 5000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];

  return (
    <Glass className="mb-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="HeartPulse" className="h-4 w-4 text-rose-300" />
          <span className="text-[12px] font-semibold text-white">ASTRA TWIN · Human, Spacesuit & Mission Intelligence</span>
          <StatusBadge status="live" note={`${steps.length} slides · 30 s`} />
        </div>
        <PlayBar count={steps.length} index={film.index} playing={film.playing} onToggle={film.toggle} onPick={film.goto} label="auto" intervalMs={5000} />
      </div>
      <div className="mt-1 text-[8px] text-slate-500">
        Global Award demo format — {steps.length} slides, {steps.length * 5} seconds at 5 s each. Plays on load; click any dot to hold a slide.
      </div>
      <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-rose-300">
        <span>step {film.index + 1}/{steps.length}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-rose-400/40 to-transparent" />
        <span className="text-slate-500">{step.k}</span>
      </div>
      <h3 className="mt-1 text-[16px] font-semibold leading-snug text-white">{step.t}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{step.b}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {step.s.map(([l, v]) => (
          <div key={l} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.08em] text-slate-500">{l}</div>
            <div className="text-[13px] font-semibold leading-tight text-white">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[8px] text-slate-500">source · {step.src}</span>
        <div className="flex items-center gap-1">
          <button className="btn-ghost !py-1 text-[10px]" onClick={() => film.goto((film.index - 1 + steps.length) % steps.length)}>← back</button>
          <button className="btn-primary !py-1 text-[10px]" onClick={() => film.goto((film.index + 1) % steps.length)}>next →</button>
        </div>
      </div>
    </Glass>
  );
}

export default HumanStory;
