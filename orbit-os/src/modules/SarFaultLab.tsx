import { useEffect, useState } from 'react';
import { Glass, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { WorkflowStrip } from '../components/WorkflowStrip';

const AOI = { lat: 37.6, lon: 36.9, name: 'East Anatolian Fault · Türkiye / Syria' };

interface Acq {
  startTime?: string;
  flightDirection?: string;
  platform?: string;
  beamMode?: string;
  sceneName?: string;
}

/** Fetches the real before/after acquisitions (Sentinel-1 ascending + NISAR descending) from ASF. */
function useAcquisitions() {
  const [data, setData] = useState<{ before?: Acq | null; after?: Acq | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const q = (platform: string) =>
      fetch(`/api/connector/asf/services/search/param?intersectsWith=POINT(${AOI.lon}%20${AOI.lat})&platform=${platform}&maxResults=1&output=json`)
        .then((r) => (r.ok ? r.json() : [[null]]))
        .then((d: Acq[][] | null) => d?.[0]?.[0] ?? null)
        .catch(() => null);
    Promise.all([q('Sentinel-1'), q('NISAR')]).then(([s1, nisar]) => {
      if (alive) setData({ before: s1, after: nisar });
    });
    return () => { alive = false; };
  }, []);
  return data;
}

function FaultMap() {
  return (
    <svg viewBox="0 0 800 440" className="h-full w-full" role="img" aria-label="East Anatolian Fault SAR footprints">
      <defs>
        <radialGradient id="sfl-defo" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.7" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.12" />
        </radialGradient>
        <pattern id="sfl-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0L0 0 0 40" fill="none" stroke="#16202b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="800" height="440" fill="#0a1018" />
      <rect width="800" height="440" fill="url(#sfl-grid)" />
      <circle cx="430" cy="220" r="170" fill="url(#sfl-defo)" />
      <path d="M250 70 L360 160 L440 240 L520 330 L600 390" stroke="#93c5fd" strokeWidth="2.5" fill="none" strokeDasharray="2 5" />
      <path d="M290 50 L380 150 L470 250 L560 350" stroke="#475569" strokeWidth="1.5" fill="none" strokeDasharray="6 6" />
      <rect x="240" y="140" width="190" height="120" fill="none" stroke="#eab308" strokeWidth="2" transform="rotate(-26 335 200)" />
      <rect x="350" y="160" width="190" height="120" fill="none" stroke="#22d3ee" strokeWidth="2" transform="rotate(-16 445 220)" />
      <circle cx="432" cy="220" r="6" fill="#ef4444" />
      <circle cx="432" cy="220" r="14" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
      <text x="440" y="205" fill="#e2e8f0" fontSize="11">East Anatolian Fault</text>
      <text x="250" y="130" fill="#eab308" fontSize="10">Sentinel-1 ascending (before)</text>
      <text x="360" y="155" fill="#22d3ee" fontSize="10">NISAR descending (after)</text>
      <text x="20" y="425" fill="#94a3b8" fontSize="12">{AOI.lat}°N, {AOI.lon}°E · {AOI.name}</text>
      <text x="690" y="30" fill="#94a3b8" fontSize="10">0 — 100 km</text>
    </svg>
  );
}

function Amplitude({ label, tone }: { label: string; tone: 'before' | 'after' }) {
  const base = tone === 'before' ? '#eab308' : '#22d3ee';
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <svg viewBox="0 0 160 110" className="mt-1 w-full rounded">
        <rect width="160" height="110" fill="#0b1220" />
        {Array.from({ length: 40 }).map((_, i) => (
          <rect key={i} x={(i % 8) * 20} y={Math.floor(i / 8) * 22} width="18" height="20" fill={base} opacity={0.15 + ((i * 37) % 60) / 120} />
        ))}
      </svg>
      <div className="mt-1 text-[9px] text-amber-300/70">SAMPLE · synthetic amplitude</div>
    </div>
  );
}

function Fringes() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">Ground deformation · InSAR fringes</div>
      <svg viewBox="0 0 160 130" className="mt-1 w-full rounded">
        <rect width="160" height="130" fill="#0b1220" />
        {Array.from({ length: 7 }).map((_, i) => {
          const hue = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'][i];
          return (
            <path key={i} d={`M 20 65 ${Array.from({ length: 120 }).map((_, x) => `${x % 2 ? 'Q' : ''}${20 + x} ${65 + Math.sin((x / 12) + i) * (18 - i * 2)}`).join(' ')}`} stroke={hue} strokeWidth="1.4" fill="none" opacity="0.85" />
          );
        })}
      </svg>
      <div className="mt-1 text-[9px] text-amber-300/70">SAMPLE · illustrative phase change</div>
    </div>
  );
}

const fmt = (s?: string) => (s ? s.replace('T', ' ').replace('Z', ' UTC').slice(0, 19) : '—');

export function SarFaultLab() {
  const acq = useAcquisitions();

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-teal-500/15 via-slate-900/20 to-slate-900/10 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-white">SAR Earth Observatory — InSAR fault lab</div>
          <p className="mt-0.5 text-xs text-slate-300">Ground-deformation change detection from NASA Earthdata (NISAR L-band + Sentinel-1 C-band) over the {AOI.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status="live" note="ASF acquisition metadata" />
          <StatusBadge status="sample" note="amplitude / fringes" />
        </div>
      </div>

      {/* study overview + map */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <Glass className="p-3">
          <div className="h-title">Study overview</div>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            {[
              ['Area of interest', `${AOI.lat}°N, ${AOI.lon}°E`],
              ['Region', AOI.name],
              ['Dataset', 'NASA Earthdata · NISAR + Sentinel-1'],
              ['Method', 'InSAR change detection'],
              ['Product', 'Line-of-sight ground deformation'],
              ['Acquisition pair', 'S1 ascending (before) ⟶ NISAR descending (after)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-white/5 pb-1 last:border-0">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
        </Glass>

        <Glass className="overflow-hidden p-0">
          <FaultMap />
        </Glass>
      </div>

      {/* acquisitions (real) + panels */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Glass className="p-3">
          <div className="h-title">Acquisition pair</div>
          <div className="mt-2 space-y-2 text-[11px]">
            <div>
              <div className="text-[10px] uppercase text-slate-500">Before · Sentinel-1 (C-band)</div>
              <div className="font-mono-data text-slate-200">{fmt(acq?.before?.startTime)}</div>
              <div className="text-slate-500">{acq?.before?.flightDirection ?? '—'} · {acq?.before?.beamMode ?? '—'}</div>
            </div>
            <div className="border-t border-white/5 pt-2">
              <div className="text-[10px] uppercase text-slate-500">After · NISAR (L-band)</div>
              <div className="font-mono-data text-slate-200">{fmt(acq?.after?.startTime)}</div>
              <div className="text-slate-500">{acq?.after?.flightDirection ?? '—'}</div>
            </div>
            <div className="text-[9px] text-emerald-300/80">● live · NASA ASF search</div>
          </div>
        </Glass>

        <Amplitude label="Before · amplitude" tone="before" />
        <Amplitude label="After · amplitude" tone="after" />
        <Fringes />
      </div>

      {/* uncertainty + traceability */}
      <div className="grid gap-2 md:grid-cols-2">
        <Glass className="p-3">
          <div className="h-title">Uncertainty</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-bold text-white">±3.8 mm</span>
            <span className="mb-1 text-[10px] text-amber-300/80">SAMPLE</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">InSAR LOS displacement precision. Not a geodetic product until Earthdata login unlocks real NISAR/Sentinel-1 products.</p>
        </Glass>
        <Glass className="p-3">
          <div className="h-title">Source traceability</div>
          <ul className="mt-2 space-y-1 text-[11px]">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Sentinel-1 IW · ASF · <a className="text-sky-400 hover:underline" href="https://asf.alaska.edu/" target="_blank" rel="noreferrer">source ↗</a></li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />NISAR L-band · ASF · <a className="text-sky-400 hover:underline" href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noreferrer">source ↗</a></li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Amplitude / fringes · SAMPLE template</li>
          </ul>
        </Glass>
      </div>

      <WorkflowStrip active={2} />

      <Provenance
        sources={[
          { name: 'NASA ASF Search', url: 'https://asf.alaska.edu/', note: 'keyless scene metadata' },
          { name: 'NISAR', url: 'https://nisar.jpl.nasa.gov/', note: 'Earthdata login for products' },
          { name: 'Sentinel-1 / Copernicus', url: 'https://dataspace.copernicus.eu/' },
        ]}
        coverage={{ start: '2026-11-03', end: '2026-11-10', label: 'acquisition window' }}
        honesty="live"
        citation="NASA ASF / NISAR · ESA Copernicus Sentinel-1"
      />
    </div>
  );
}
