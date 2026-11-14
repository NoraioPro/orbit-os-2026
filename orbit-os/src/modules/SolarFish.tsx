import { useState } from 'react';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';

/* ------------------------------------------------------------------ *
 * SolarFish — marine habitat intelligence (extracted from the
 * SolarFish_AI_V9 project). Species ecological profiles are the
 * literature-informed starting values from that project; they are NOT
 * fitted to catch data. Habitat suitability (HSI) is relative, not a
 * catch prediction or abundance estimate. Salmon is conservation-only.
 * ------------------------------------------------------------------ */

interface Zone { name: string; kind: string; months: [number, number][] }
interface SpeciesProfile {
  key: string; common: string; scientific: string; group: string; color: string;
  temp: [number, number, number, number]; // lo, opt_lo, opt_hi, hi (°C)
  chl: [number, number, number, number];   // log10 mg m^-3
  depth: [number, number, number, number]; // metres
  weights: { label: string; value: number }[];
  conservationOnly?: boolean; tempIsProxy?: boolean;
  spawning: string; notes: string[]; regulation: string; zones: Zone[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SPECIES: SpeciesProfile[] = [
  {
    key: 'mackerel', common: 'Atlantic mackerel', scientific: 'Scomber scombrus', group: 'Small pelagic', color: '#00D9FF',
    temp: [6, 9, 14, 20], chl: [0.1, 0.3, 2.5, 10], depth: [20, 60, 1500, 4000],
    weights: [{ label: 'Temperature', value: 0.38 }, { label: 'Chlorophyll', value: 0.17 }, { label: 'Depth', value: 0.12 }, { label: 'Fronts', value: 0.15 }, { label: 'Season', value: 0.18 }],
    spawning: 'March–July (western/southern components); North Sea component May–July.',
    notes: ['Visual feeder on zooplankton; associated with thermal fronts.', 'Mostly reported at 9–14 °C; avoids water much below ~7 °C.'],
    regulation: 'Quota-managed (NEA mackerel). Check Fiskeridirektoratet J-messages and ICES advice.',
    zones: [
      { name: 'Norwegian Sea summer feeding', kind: 'feeding', months: [[5, .5], [6, .9], [7, 1], [8, 1], [9, .7], [10, .3]] },
      { name: 'North Sea spawning', kind: 'spawning', months: [[5, .8], [6, 1], [7, .8], [8, .3]] },
      { name: 'Northern North Sea autumn aggregation', kind: 'overwintering', months: [[9, .7], [10, 1], [11, 1], [12, .8], [1, .7], [2, .5]] },
    ],
  },
  {
    key: 'herring', common: 'Atlantic herring', scientific: 'Clupea harengus', group: 'Small pelagic', color: '#7FD3FF',
    temp: [2, 5, 12, 17], chl: [0.1, 0.4, 3.0, 12], depth: [10, 30, 400, 1500],
    weights: [{ label: 'Temperature', value: 0.32 }, { label: 'Chlorophyll', value: 0.18 }, { label: 'Depth', value: 0.18 }, { label: 'Fronts', value: 0.10 }, { label: 'Season', value: 0.22 }],
    spawning: 'NSS herring Feb–Apr along the Norwegian coast; North Sea autumn spawners Aug–Oct.',
    notes: ['Plankton feeder; demersal egg-laying on gravel beds.', 'Several stocks (North Sea autumn spawners, Norwegian spring spawners) — combined seasonal prior.'],
    regulation: 'Stock-specific quotas and spawning-ground protections apply.',
    zones: [
      { name: 'Norwegian spring-spawning · coastal', kind: 'spawning', months: [[2, 1], [3, 1], [4, .5]] },
      { name: 'Norwegian Sea feeding', kind: 'feeding', months: [[5, .8], [6, 1], [7, 1], [8, .8]] },
      { name: 'North Sea autumn spawners', kind: 'spawning', months: [[8, .8], [9, 1], [10, .8]] },
    ],
  },
  {
    key: 'cod', common: 'Atlantic cod', scientific: 'Gadus morhua', group: 'Demersal', color: '#D8B66A', tempIsProxy: true,
    temp: [0, 3, 9, 14], chl: [0.1, 0.3, 4.0, 15], depth: [15, 50, 400, 900],
    weights: [{ label: 'Temperature', value: 0.30 }, { label: 'Chlorophyll', value: 0.05 }, { label: 'Depth', value: 0.35 }, { label: 'Fronts', value: 0.05 }, { label: 'Season', value: 0.25 }],
    spawning: 'Jan–Apr; NEA cod spawn around Lofoten in Mar–Apr.',
    notes: ['Demersal: SST is only a proxy for the bottom temperature that matters.', 'North Sea cod has been at low stock size.'],
    regulation: 'Strict quotas, closed areas and bycatch rules; North Sea cod recovery measures.',
    zones: [
      { name: 'Lofoten spawning (NEA cod)', kind: 'spawning', months: [[2, .8], [3, 1], [4, .9]] },
      { name: 'Northern North Sea & coastal', kind: 'feeding', months: Array.from({ length: 12 }, (_, i) => [i + 1, .55] as [number, number]) },
      { name: 'North Sea spawning grounds', kind: 'spawning', months: [[1, .7], [2, .9], [3, .8], [4, .4]] },
    ],
  },
  {
    key: 'salmon', common: 'Atlantic salmon (wild, at sea)', scientific: 'Salmo salar', group: 'Anadromous', color: '#F28CA8', conservationOnly: true,
    temp: [3, 7, 12, 16], chl: [0.1, 0.3, 3.0, 12], depth: [0, 50, 4000, 6000],
    weights: [{ label: 'Temperature', value: 0.40 }, { label: 'Chlorophyll', value: 0.10 }, { label: 'Depth', value: 0.05 }, { label: 'Fronts', value: 0.10 }, { label: 'Season', value: 0.35 }],
    spawning: 'Spawns in rivers Oct–Dec (freshwater, outside this marine model).',
    notes: ['Included for CONSERVATION and research — wild salmon at sea are heavily protected.'],
    regulation: 'Sea fishing for wild Atlantic salmon is heavily restricted in most Norwegian waters — never a fishing recommendation.',
    zones: [
      { name: 'Post-smolt coastal migration', kind: 'migration', months: [[4, .6], [5, 1], [6, .9]] },
      { name: 'Norwegian Sea feeding', kind: 'feeding', months: [[6, .6], [7, .9], [8, 1], [9, .8], [10, .5]] },
    ],
  },
  {
    key: 'bluefin', common: 'Atlantic bluefin tuna', scientific: 'Thunnus thynnus', group: 'Highly migratory', color: '#29D6A0',
    temp: [10, 14, 22, 28], chl: [0.08, 0.2, 1.5, 5], depth: [40, 150, 4000, 6000],
    weights: [{ label: 'Temperature', value: 0.36 }, { label: 'Chlorophyll', value: 0.08 }, { label: 'Depth', value: 0.10 }, { label: 'Fronts', value: 0.18 }, { label: 'Season', value: 0.28 }],
    spawning: 'Spawns in the Mediterranean / Gulf of Mexico (outside region).',
    notes: ['Returned to Scandinavian waters in the 2010s; feeds on mackerel and herring.', 'A future version should use prey HSI as a predictor.'],
    regulation: 'ICCAT-managed with very small national quotas and tagging programmes.',
    zones: [
      { name: 'Late-summer feeding off western Norway', kind: 'feeding', months: [[7, .4], [8, 1], [9, 1], [10, .7]] },
      { name: 'Skagerrak / Kattegat late-summer', kind: 'feeding', months: [[8, .7], [9, .9], [10, .5]] },
    ],
  },
  {
    key: 'sardine', common: 'European sardine', scientific: 'Sardina pilchardus', group: 'Small pelagic', color: '#FFB86B',
    temp: [10, 13, 19, 25], chl: [0.2, 0.6, 5.0, 20], depth: [5, 15, 150, 500],
    weights: [{ label: 'Temperature', value: 0.42 }, { label: 'Chlorophyll', value: 0.22 }, { label: 'Depth', value: 0.14 }, { label: 'Fronts', value: 0.07 }, { label: 'Season', value: 0.15 }],
    spawning: 'Spring–summer spawning in Bay of Biscay / Channel (mostly south of region).',
    notes: ['Warm-water species at its northern range edge; a good "climate indicator" species.'],
    regulation: 'Limited/no dedicated North Sea quota framework; check national rules.',
    zones: [
      { name: 'Southern North Sea & Channel summer', kind: 'feeding', months: [[6, .7], [7, 1], [8, 1], [9, .9], [10, .6]] },
    ],
  },
];

function RangeBar({ r, unit, color, log = false }: { r: [number, number, number, number]; unit: string; color: string; log?: boolean }) {
  const [lo, ol, oh, hi] = r;
  const span = hi - lo || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  return (
    <div>
      <div className="relative h-2 w-full rounded bg-white/10">
        <div className="absolute inset-y-0 rounded" style={{ left: `${pct(ol)}%`, width: `${Math.max(2, pct(oh) - pct(ol))}%`, background: color, opacity: 0.85 }} />
        <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${pct(ol)}%` }} />
        <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${pct(oh)}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-slate-500"><span>{log ? '10' : lo}{unit}</span><span className="text-slate-400">opt {ol}–{oh}{unit}</span><span>{hi}{unit}</span></div>
    </div>
  );
}

export function SolarFish() {
  const [sel, setSel] = useState(SPECIES[0]);
  const maxW = Math.max(...sel.weights.map((w) => w.value));

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Icon name="Waves" className="h-4 w-4 text-cyan-300" /><span className="h-title">SolarFish · habitat forecaster</span><StatusBadge status="snapshot" note="species profiles · literature-informed" /></div>
        <span className="text-[11px] text-slate-500">challenge #2 · Be an Earth System Trend Detective</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Satellites cannot see fish underwater — SolarFish estimates <b className="text-slate-200">where the environment is suitable</b> for a species, with the uncertainty stated. Decision support, not a catch prediction.</p>

      {/* Species selector */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SPECIES.map((s) => (
          <button key={s.key} onClick={() => setSel(s)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${sel.key === s.key ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.common}{s.conservationOnly ? ' 🛡️' : ''}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        {/* Left: ecological profile */}
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-sm font-semibold text-white">{sel.common}</div><div className="text-[10px] italic text-slate-500">{sel.scientific} · {sel.group}</div></div>
              {sel.conservationOnly && <Chip className="border-rose-400/40 text-rose-200">🛡️ conservation only</Chip>}
              {sel.tempIsProxy && <Chip className="border-amber-400/30 text-amber-200">SST is a proxy for bottom temp</Chip>}
            </div>
            <div className="mt-3 space-y-2.5">
              <div><div className="mb-0.5 text-[10px] text-slate-400">Temperature (°C)</div><RangeBar r={sel.temp} unit="°C" color={sel.color} /></div>
              <div><div className="mb-0.5 text-[10px] text-slate-400">Chlorophyll-a (log₁₀ mg m⁻³)</div><RangeBar r={sel.chl} unit="" color="#4ade80" log /></div>
              <div><div className="mb-0.5 text-[10px] text-slate-400">Bottom depth (m)</div><RangeBar r={sel.depth} unit=" m" color="#a78bfa" /></div>
            </div>
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="mb-1 text-[10px] text-slate-400">Factor weights</div>
              <div className="space-y-1">
                {sel.weights.map((w) => (
                  <div key={w.label} className="flex items-center gap-2 text-[11px]"><span className="w-24 shrink-0 text-slate-400">{w.label}</span><div className="h-1.5 flex-1 rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${(w.value / maxW) * 100}%`, background: sel.color }} /></div><span className="w-9 shrink-0 text-right tabular-nums text-slate-300">{w.value}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-[11px] text-slate-300">
            <div className="mb-1 font-semibold text-white">Seasonal zones</div>
            <ul className="space-y-1.5">
              {sel.zones.map((z) => (
                <li key={z.name} className="flex items-center gap-2"><span className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${z.kind === 'spawning' ? 'bg-amber-500/20 text-amber-200' : z.kind === 'feeding' ? 'bg-emerald-500/15 text-emerald-200' : z.kind === 'migration' ? 'bg-sky-500/15 text-sky-200' : 'bg-violet-500/15 text-violet-200'}`}>{z.kind}</span><span className="flex-1 text-slate-200">{z.name}</span><span className="flex gap-0.5">{z.months.map(([m, w]) => <span key={m} className="text-[9px]" style={{ color: w >= 1 ? '#fff' : w >= 0.7 ? '#94a3b8' : '#475569' }}>{MONTHS[m - 1]}</span>)}</span></li>
              ))}
            </ul>
            <div className="mt-1 text-[9px] text-slate-500">Month shading = seasonal prior strength (0–1).</div>
          </div>
        </div>

        {/* Right: notes + regulation + formula */}
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-[11px]">
            <div className="mb-1 font-semibold text-white">Why this habitat</div>
            <ul className="space-y-1 text-slate-300">{sel.notes.map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-sky-300">·</span>{n}</li>)}</ul>
            <div className="mt-2 text-[10px] text-slate-400"><b className="text-slate-300">Spawning:</b> {sel.spawning}</div>
          </div>

          <div className="rounded-lg border border-amber-400/25 bg-amber-500/5 p-3 text-[11px] text-amber-100"><b>Regulation:</b> {sel.regulation}</div>

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-[11px]">
            <div className="mb-1 font-semibold text-white">HSI model (interpretable)</div>
            <div className="rounded bg-black/30 p-2 font-mono text-[10px] text-sky-200">HSI = 100 · exp( Σ wᵢ · ln fᵢ(xᵢ) / Σ wᵢ )</div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">A weighted geometric mean over temperature, chlorophyll, depth, fronts and season — so one unsuitable factor limits the score (Liebig's law). Uncertainty comes from 24 Monte-Carlo samples (SST ±0.4 °C, chlorophyll ±0.15 log₁₀, optimum ±0.75 °C).</p>
          </div>

          <div className="rounded-lg border border-rose-400/25 bg-rose-500/5 p-3 text-[11px] text-rose-100"><b>Honesty:</b> HSI is <b>relative suitability</b>, not a probability, abundance or catch prediction. Species profiles are literature-informed starting values — <b>not calibrated against catches</b>. Salmon is shown for conservation only, never as a fishing recommendation.</div>
        </div>
      </div>
    </Glass>
  );
}

export default SolarFish;
