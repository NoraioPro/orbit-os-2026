import { useEffect, useState } from 'react';
import { fetchJson } from '../data/live';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';

/**
 * Kahramanmaras M7.8 · 6 Feb 2023.
 *
 * The event row (magnitude, place, time, depth, coordinates, MMI, alert) is the
 * reviewed USGS catalog record fetched by scripts/build-domains.mjs. The InSAR
 * field and its statistics are a fixed-seed illustration and say so on every
 * card — the deformation is NOT measured in this build.
 */

interface UsgsEvent {
  eventId: string;
  url: string;
  title: string | null;
  place: string | null;
  magnitude: number | null;
  magType: string | null;
  timeUtc: string | null;
  depthKm: number | null;
  lat: number | null;
  lon: number | null;
  mmi: number | null;
  alert: string | null;
  significance: number | null;
  felt: number | null;
  reviewStatus: string | null;
  network: string | null;
  queryUrl: string;
}
interface EventFile {
  generated_at: string;
  provenance: { provider: string; url: string; access: string; honesty: string; note: string };
  event: UsgsEvent;
}

const SAMPLE = {
  maxUpliftM: 1.2,
  maxSubsidenceM: -1.1,
  deformedKm2: 2800,
  coherence: 0.86,
  confidence: 0.86,
};

/** stylised LOS field: two lobes along the fault, warm = toward satellite */
function losColor(t: number) {
  // t: -1 (away) .. 1 (toward)
  const a = Math.abs(t);
  return t >= 0 ? `rgba(251,146,60,${0.15 + a * 0.6})` : `rgba(56,189,248,${0.15 + a * 0.6})`;
}

export function TurkiyeBoard() {
  const [file, setFile] = useState<EventFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchJson('/data/domains/events-turkiye.json', 9000)
      .then((f: EventFile) => live && setFile(f))
      .catch((e: Error) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, []);

  const ev = file?.event;
  const when = ev?.timeUtc ? new Date(ev.timeUtc) : null;

  return (
    <Glass className="flex flex-col gap-3 border-rose-400/25 bg-gradient-to-b from-rose-500/[0.07] to-transparent p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-rose-300"><Icon name="TriangleAlert" className="h-4 w-4" /></div>
            <h3 className="text-[15px] font-semibold text-white">
              {ev ? `M${ev.magnitude} · ${ev.place ?? 'Kahramanmaras'}` : 'Kahramanmaras earthquake'}
            </h3>
            <StatusBadge status="live" note="usgs catalog" />
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {when ? `${when.toISOString().replace('T', ' ').slice(0, 19)} UTC` : '2023-02-06 01:17:34 UTC'} · depth {ev?.depthKm ?? '—'} km ·{' '}
            {ev?.lat?.toFixed(3) ?? '—'}°N {ev?.lon?.toFixed(3) ?? '—'}°E · MMI {ev?.mmi?.toFixed(1) ?? '—'} · alert {ev?.alert ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ev && <a href={ev.url} target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-1 text-[11px]">USGS record ↗</a>}
          <Chip><Icon name="Database" className="h-3 w-3" />{ev?.network ?? 'us'}</Chip>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          Event record failed to load ({err}). Run <code className="rounded bg-white/10 px-1">npm run data:domains</code> — the board never substitutes an estimate for the catalog row.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        {/* LOS field */}
        <div className="relative min-h-[280px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
          <svg viewBox="0 0 400 280" className="h-full w-full" role="img" aria-label="Stylised line-of-sight deformation field around the fault">
            <defs>
              <radialGradient id="lobeU" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={losColor(0.95)} />
                <stop offset="100%" stopColor="rgba(251,146,60,0)" />
              </radialGradient>
              <radialGradient id="lobeD" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={losColor(-0.9)} />
                <stop offset="100%" stopColor="rgba(56,189,248,0)" />
              </radialGradient>
            </defs>
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 35} x2="400" y2={i * 35} stroke="rgba(148,163,184,.08)" />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 33} y1="0" x2={i * 33} y2="280" stroke="rgba(148,163,184,.06)" />
            ))}
            {/* two deformation lobes either side of the East Anatolian Fault trace */}
            <ellipse cx="150" cy="120" rx="110" ry="70" fill="url(#lobeU)" />
            <ellipse cx="255" cy="180" rx="110" ry="70" fill="url(#lobeD)" />
            <path d="M40 250 L120 190 L190 150 L250 105 L330 40" stroke="rgba(248,113,113,.85)" strokeWidth="2" strokeDasharray="6 4" fill="none" />
            <circle cx="176" cy="152" r="4.5" fill="#f87171" />
            <circle cx="176" cy="152" r="11" fill="none" stroke="rgba(248,113,113,.5)" />
            {[
              { x: 128, y: 108, label: 'Pazarcik' },
              { x: 244, y: 172, label: 'Nurdagi' },
              { x: 186, y: 140, label: 'Kahramanmaras' },
            ].map((p) => (
              <g key={p.label}>
                <circle cx={p.x} cy={p.y} r="2.5" fill="#e2e8f0" />
                <text x={p.x + 6} y={p.y + 3} fill="#cbd5e1" fontSize="8">{p.label}</text>
              </g>
            ))}
            <text x="12" y="18" fill="#94a3b8" fontSize="9">LOS deformation · stylised · SAMPLE</text>
          </svg>
          <div className="absolute bottom-2 left-3 right-3">
            <div className="h-2 w-full rounded" style={{ background: 'linear-gradient(90deg,#38bdf8,#0f172a,#fb923c)' }} />
            <div className="mt-0.5 flex justify-between text-[9px] text-slate-400"><span>−1.2 m away</span><span>no change</span><span>+1.2 m toward</span></div>
            <div className="text-[9px] text-amber-300/80">stylised field, hand-placed lobes — not an interferogram, not a measurement of this event</div>
          </div>
        </div>

        {/* stats */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Max uplift', value: `+${SAMPLE.maxUpliftM.toFixed(1)}`, unit: 'm LOS', tone: 'text-orange-300' },
              { label: 'Max subsidence', value: SAMPLE.maxSubsidenceM.toFixed(1), unit: 'm LOS', tone: 'text-sky-300' },
              { label: 'Deformed area', value: SAMPLE.deformedKm2.toLocaleString('en-US'), unit: 'km²', tone: 'text-slate-200' },
              { label: 'Confidence', value: SAMPLE.confidence.toFixed(2), unit: 'index', tone: 'text-slate-200' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{s.label}</span>
                  <span className="shrink-0 rounded border border-amber-400/30 bg-amber-500/10 px-1 py-[1px] text-[9px] font-semibold uppercase text-amber-300">sample</span>
                </div>
                <div className={`mt-1 text-[19px] font-semibold leading-none ${s.tone}`}>
                  {s.value}<span className="ml-1 text-[10px] font-normal text-slate-400">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Sources for this board</div>
            <ul className="mt-1 space-y-1 text-[11px]">
              <li className="flex items-center justify-between gap-2"><span className="text-slate-200">USGS Earthquake Catalog</span><span className="text-emerald-300">real · event row</span></li>
              <li className="flex items-center justify-between gap-2"><span className="text-slate-200">NASA NISAR L2 InSAR</span><span className="text-amber-300">not connected</span></li>
              <li className="flex items-center justify-between gap-2"><span className="text-slate-200">Copernicus Sentinel-1 SLC</span><span className="text-amber-300">not connected</span></li>
              <li className="flex items-center justify-between gap-2"><span className="text-slate-200">Deformation field</span><span className="text-amber-300">sample</span></li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Timeline</div>
            <ol className="mt-1 space-y-1 text-[10px]">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /><span className="text-slate-200">2023-02-06 01:17:34 UTC</span><span className="text-slate-500">M7.8 event (USGS)</span></li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="text-slate-200">sample product</span><span className="text-slate-500">InSAR pair selection</span></li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="text-slate-200">sample product</span><span className="text-slate-500">displacement + coherence</span></li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /><span className="text-slate-200">not run</span><span className="text-slate-500">validation against field reports</span></li>
            </ol>
          </div>
        </div>
      </div>

      {file && (
        <Provenance
          honesty="live"
          coverage={{ start: '2023-02-06', end: (ev?.timeUtc ?? '2023-02-06').slice(0, 10), label: 'event time; the deformation field is not dated because it is not measured' }}
          citation="USGS FDSN event service · ORBIT OS domain file scripts/build-domains.mjs"
          sources={[
            { name: 'USGS Earthquake Catalog', url: ev?.queryUrl ?? 'https://earthquake.usgs.gov/fdsnws/event/1/', note: `event ${ev?.eventId ?? 'us6000jllz'} · ${ev?.reviewStatus ?? 'reviewed'}` },
            { name: 'NASA NISAR', url: 'https://nisar.jpl.nasa.gov/data/', note: 'L2 InSAR — not connected in this build' },
            { name: 'Copernicus Sentinel-1', url: 'https://dataspace.copernicus.eu/', note: 'SLC — not connected in this build' },
          ]}
        />
      )}
    </Glass>
  );
}
