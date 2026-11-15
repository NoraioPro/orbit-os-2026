import { useEffect, useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';

/** Human Space Lab — story mode: the 3D EVA artifact is the stage, C4 is the claim. */
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
        k: 'The stage, not a picture',
        t: 'Open the suit, layer by layer — the model is the argument',
        b: 'The NORGE EVA build lab below is a real 3D artifact you can explode into its layers and walk through part by part. It is not a diagram of a suit: it is the assembly, so a reviewer can see what a C4 monitor would have to be threaded through — helmet, life support, torso, limbs — before any health claim is made.',
        s: [['Stage', '3D EVA artifact'], ['Layers', '9'], ['Claims', 'assembly only']],
        src: 'components/EvaLab.tsx — the model below',
      },
      {
        k: 'C4 · what the monitor would read',
        t: 'Heart rate, SpO₂, temperature — and why this build shows none of them',
        b: 'A health monitor is only credible if its inputs are real. This build has no crew telemetry feed, so the physiology panel shows nothing rather than a plausible pulse: the synthetic telemetry that used to sit here was removed. What the page delivers instead is the suit architecture the sensors would belong to, and the honest label that the readings are not connected.',
        s: [['Physiology feed', 'not connected'], ['Suit architecture', 'real'], ['Synthetic values', 'removed']],
        src: 'Module honesty notes — C4',
      },
      {
        k: 'The environment it must survive',
        t: now?.airTempC != null ? `Outside today: ${now.airTempC.toFixed(1)} °C, ${now.windMs?.toFixed(1)} m/s${s?.sun?.polar ? ', polar night' : ''}` : 'The environment it must survive',
        b: 'A suit is specified against an environment. MET Norway gives a measured one at 78.22°N — temperature, wind and the polar-night flag — so the thermal and power load has a source with a timestamp instead of a rounded assumption.',
        s: [['Temperature', now?.airTempC != null ? `${now.airTempC.toFixed(1)} °C` : '—'], ['Wind', now?.windMs != null ? `${now.windMs.toFixed(1)} m/s` : '—'], ['Daylight', s?.sun?.polar ?? 'rise/set']],
        src: 'public/data/norway/index.json · MET Norway',
      },
      {
        k: 'Why it is different',
        t: 'One real artifact, one honest gap, no simulated vitals',
        b: 'Most astronaut-health demos animate a fake pulse because it looks convincing. This page keeps the 3D assembly that is genuinely real, states that the biological feed is not connected, and anchors the environment to a live observation — simplification that removes the decoration and keeps the proof.',
        s: [['Real artifacts', '1 (3D suit)'], ['Fake vitals', '0'], ['Traceable inputs', 'environment']],
        src: 'Module design note — Human Space Lab',
      },
    ];
  }, [nor]);

  const film = useAutoPlay(steps.length, 7000, 0, true);
  const step = steps[Math.min(film.index, steps.length - 1)];

  return (
    <Glass className="mb-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="HeartPulse" className="h-4 w-4 text-rose-300" />
          <span className="text-[12px] font-semibold text-white">Human Space Lab · the story</span>
          <StatusBadge status="live" note={`${steps.length} steps · auto-playing`} />
        </div>
        <PlayBar count={steps.length} index={film.index} playing={film.playing} onToggle={film.toggle} onPick={film.goto} label="auto" intervalMs={7000} />
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
