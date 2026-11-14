import { useMemo, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { zScoreOutliers, type SeriesPoint } from '../kernel';
import { rng } from './rng';

type ChannelId = 'hr' | 'spo2' | 'sleep';

interface ChannelDef {
  id: ChannelId;
  label: string;
  short: string;
  unit: string;
  color: string;
  icon: string;
  threshold: number;
  xLabel: (x: number) => string;
  baseline: string;
  note: string;
}

const CHANNELS: ChannelDef[] = [
  { id: 'hr', label: 'Heart rate', short: 'HR', unit: 'bpm', color: '#f472b6', icon: 'HeartPulse', threshold: 2.5, xLabel: (x) => `${Math.round(x / 4)}h`, baseline: '≈ 62 bpm resting', note: 'Synthetic beat-averaged rate, 15-minute bins over one simulated day.' },
  { id: 'spo2', label: 'Blood oxygen', short: 'SpO₂', unit: '%', color: '#34d399', icon: 'Activity', threshold: 3, xLabel: (x) => `${Math.round(x / 4)}h`, baseline: '≈ 97 %', note: 'Synthetic peripheral oxygen saturation over one simulated day.' },
  { id: 'sleep', label: 'Sleep duration', short: 'Sleep', unit: 'h/night', color: '#a78bfa', icon: 'Moon', threshold: 2, xLabel: (x) => `n${x + 1}`, baseline: '≈ 7 h', note: 'Synthetic nightly sleep log over 14 simulated nights.' },
];

/** Deterministic, obviously-synthetic telemetry: baseline + slow sinusoid + noise + injected deviations. */
function makeSeries(seed: number, n: number, base: number, amp: number, noise: number, anomalies: { start: number; end: number; delta: number }[]): SeriesPoint[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    let y = base + amp * Math.sin((i / n) * Math.PI * 2) + (r() - 0.5) * noise;
    for (const a of anomalies) if (i >= a.start && i <= a.end) y += a.delta;
    return { x: i, y: Math.round(y * 10) / 10 };
  });
}

/** Schematic flame-shape comparison — illustration, not a simulation or scale drawing. */
function FlamePair() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
        <svg viewBox="0 0 100 120" className="mx-auto h-28 w-24" role="img" aria-label="Schematic teardrop flame in normal gravity">
          <defs><radialGradient id="flEarth" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stopColor="#fef3c7" /><stop offset="0.55" stopColor="#fb923c" /><stop offset="1" stopColor="#f97316" stopOpacity="0" /></radialGradient></defs>
          <path d="M50 16 C 64 40, 70 62, 50 100 C 30 62, 36 40, 50 16 Z" fill="url(#flEarth)" />
          <rect x="46" y="100" width="8" height="14" rx="1.5" fill="#64748b" />
        </svg>
        <div className="text-center text-[11px] font-semibold text-white">Earth · 1 g</div>
        <div className="text-center text-[10px] text-slate-400">buoyant teardrop, hot products rise</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
        <svg viewBox="0 0 100 120" className="mx-auto h-28 w-24" role="img" aria-label="Schematic spherical flame in microgravity">
          <defs><radialGradient id="flMicro" cx="0.5" cy="0.5" r="0.55"><stop offset="0" stopColor="#fef3c7" /><stop offset="0.55" stopColor="#60a5fa" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></radialGradient></defs>
          <circle cx="50" cy="58" r="34" fill="url(#flMicro)" />
          <rect x="46" y="92" width="8" height="14" rx="1.5" fill="#64748b" />
        </svg>
        <div className="text-center text-[11px] font-semibold text-white">Microgravity · ~0 g</div>
        <div className="text-center text-[10px] text-slate-400">spherical diffusion flame, no buoyancy</div>
      </div>
    </div>
  );
}

export function HumanLab() {
  const [channel, setChannel] = useState<ChannelId>('hr');

  const series = useMemo<Record<ChannelId, SeriesPoint[]>>(() => ({
    hr: makeSeries(4, 96, 62, 6, 5, [{ start: 56, end: 59, delta: 24 }]),
    spo2: makeSeries(11, 96, 97, 0.5, 0.7, [{ start: 44, end: 48, delta: -4.5 }]),
    sleep: makeSeries(23, 14, 7, 1.2, 0.5, [{ start: 9, end: 9, delta: -4 }]),
  }), []);

  const active = CHANNELS.find((c) => c.id === channel)!;
  const points = series[channel];
  const outliers = useMemo(() => zScoreOutliers(points, active.threshold), [points, active.threshold]);

  return (
    <div className="space-y-3">
      <PageHeader
        icon="HeartPulse"
        title="Human Space Lab"
        subtitle="Astronaut health monitoring (challenge #4) and microgravity combustion (challenge #7) — kept honest and kept separate."
        right={<StatusBadge status="sample" note="SAMPLE · synthetic, reproducible telemetry" />}
      />

      {/* ---------- Section 1 · Astronaut Health Monitor ---------- */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-title">Astronaut Health Monitor</div>
            <Chip className="border-violet-400/30 text-violet-200">challenge #4</Chip>
          </div>
          <div className="flex gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                aria-pressed={channel === c.id}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${channel === c.id ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.color }} />
                {c.short}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200">
          <StatusBadge status="sample" />
          <span><b>SAMPLE DATA — concept only.</b> This is deterministic synthetic telemetry used to illustrate the kernel's anomaly-detection pattern. It is <b>not medical advice</b> and <b>not flight-safety guidance</b>: nothing here diagnoses a condition, clears a crew member for duty, or informs a safety decision.</span>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{active.label} <span className="text-slate-500">· {active.baseline}</span></span>
            <Chip>z-threshold {active.threshold}</Chip>
          </div>
          <LineChart points={points} unit={active.unit} color={active.color} xLabel={active.xLabel} height={180} />
          <p className="mt-1 text-[10px] text-slate-500">{active.note} Anomaly detection = z-score of each reading against this channel's own mean and spread.</p>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_300px] gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[.03] p-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white"><Icon name="TriangleAlert" className="h-4 w-4 text-amber-300" />Review queue — statistical flags only</div>
            <p className="mt-1 text-[11px] text-slate-400">
              {outliers.length} of {points.length} readings exceeded |z| ≥ {active.threshold}. In a real deployment each flag would be queued for a flight surgeon's review. The kernel never diagnoses.
            </p>
            {outliers.length > 0 && (
              <ul className="scroll-thin mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {outliers.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-white/10 p-1.5">
                    <span className="text-slate-300">{active.xLabel(o.x)}</span>
                    <span className="font-semibold" style={{ color: active.color }}>{o.y!.toFixed(1)} {active.unit}</span>
                    <span className="text-amber-300">z = {o.z >= 0 ? '+' : ''}{o.z.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/5 p-2.5 text-[11px] text-rose-100">
            <div className="flex items-center gap-2 text-xs font-semibold"><Icon name="ShieldCheck" className="h-4 w-4 text-rose-300" />Hard disclaimer</div>
            <p className="mt-1">This is an educational prototype. It makes <b>no medical or flight-safety claim</b>. A z-score outlier is a statistical deviation from a synthetic baseline — not a health finding, not an alarm. Any real physiological review belongs to a qualified human flight surgeon.</p>
          </div>
        </div>
      </Glass>

      {/* ---------- Section 2 · Microgravity Combustion ---------- */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-title">Microgravity Combustion</div>
            <Chip className="border-violet-400/30 text-violet-200">challenge #7</Chip>
          </div>
          <StatusBadge status="sample" note="explainer · no live data merged" />
        </div>

        <div className="mt-3 grid grid-cols-[260px_minmax(0,1fr)] gap-4">
          <FlamePair />
          <div className="text-sm text-slate-300">
            <p className="text-xs font-semibold text-white">How a flame behaves without gravity</p>
            <p className="mt-1.5 text-xs leading-relaxed">
              On Earth, hot combustion products are lighter than the surrounding air, so buoyancy pulls a flame upward into a teardrop: rising gases draw in fresh oxidiser from below and feed the burn. In microgravity that buoyant flow effectively vanishes. A flame instead forms a <b>spherical diffusion flame</b> that grows outward, fed only by molecular diffusion of oxygen into the fuel vapour.
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              This is a <b>different physical regime</b>: combustion can be cooler, slower and longer-lived, and can smoulder in ways that would be quenched under gravity. It is studied in its own right (for example in flame experiments flown in orbit) precisely because the Earth rules do not apply.
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/5 p-3 text-xs text-rose-100">
          <div className="flex items-center gap-2 font-semibold"><Icon name="Flame" className="h-4 w-4 text-rose-300" />Kept separate from Earth wildfire data — by design</div>
          <ul className="mt-2 space-y-1.5">
            <li><b>Different physical regime.</b> FIRMS and EONET record Earth-surface thermal anomalies and active-fire pixels governed by gravity-driven convection and real-world fuels. A microgravity diffusion flame obeys different physics, so a shared "fire" metric would be scientifically invalid.</li>
            <li><b>Different detection signatures.</b> Satellite fire products detect surface radiative signatures at landscape scale; a small enclosed combustion experiment is an instrumented, controlled event. The two cannot be meaningfully combined or compared.</li>
            <li><b>ORBIT never merges them.</b> No Earth wildfire statistic is derived from challenge #7 data, and no microgravity finding is folded into FIRMS/EONET feeds.</li>
          </ul>
          <p className="mt-2 text-[11px] text-rose-200/80">Shared kernel use is limited to the human-review workflow and to series anomaly detection on experiment telemetry — and that telemetry is sample data only.</p>
        </div>
      </Glass>
    </div>
  );
}

export default HumanLab;
