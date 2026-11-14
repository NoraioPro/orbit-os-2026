import { useEffect, useMemo, useState } from 'react';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { SarCanvas, ampPalette, changePalette, phasePalette } from '../components/SarCanvas';
import {
  backscatterChange, classifyChange, phaseToDisplacement, relateEvents,
  simulateSarPair, SAR_MISSIONS, type SarRaster,
} from '../kernel';
import { useStore } from '../state/store';
import { TYPE_META } from '../data/events';

// ─────────────────────────────────────────────────────────────────────────────
// SAR Champion — "Dancing with the SARs" (NASA Space Apps Challenge #5)
// Surface-change detection + InSAR displacement, driven by the ORBIT SAR kernel,
// alongside a LIVE ASF (Alaska Satellite Facility) acquisition catalogue.
//
// Honesty contract (enforced here, not just promised):
//  • The before/after rasters and the InSAR phase → displacement raster are
//    SYNTHETIC, produced by simulateSarPair / a seeded phase field. They are
//    labelled SAMPLE everywhere and are NOT derived from the live granules.
//  • The acquisition catalogue is fetched LIVE, keyless, from the ASF SearchAPI
//    and displays the exact fields the API returns (startTime, processingLevel,
//    platform, polarization). It is labelled LIVE.
//  • Single line-of-sight caveat is shown prominently and never softened.
// ─────────────────────────────────────────────────────────────────────────────

type Bbox = [number, number, number, number];

interface Aoi {
  id: string;
  name: string;
  region: string;
  bbox: Bbox;   // [minLon, minLat, maxLon, maxLat]
  lat: number;  // area centre (for event cross-linking + synthetic raster)
  lon: number;
}

const AOIS: Aoi[] = [
  { id: 'sfbay', name: 'San Francisco Bay', region: 'California, USA', bbox: [-122.6, 37.5, -121.9, 38.0], lat: 37.75, lon: -122.25 },
  { id: 'iceland', name: 'Iceland (rift & volcano)', region: 'Southwest Iceland', bbox: [-21.5, 63.8, -20.0, 64.4], lat: 64.15, lon: -20.9 },
  { id: 'amazon', name: 'Amazon frontier', region: 'Amazonas, Brazil', bbox: [-60.5, -3.5, -59.5, -2.5], lat: -3.0, lon: -60.0 },
  { id: 'alps', name: 'Swiss Alps (ice)', region: 'Valais, Switzerland', bbox: [7.0, 45.8, 8.0, 46.4], lat: 46.1, lon: 7.5 },
];

const SCENARIOS = [
  { id: 'flood', name: 'Flood / inundation' },
  { id: 'urban', name: 'Urban growth' },
  { id: 'deforestation', name: 'Forest disturbance' },
  { id: 'glacier', name: 'Glacier / ice change' },
];

interface AsfGranule {
  granuleName: string | null;
  startTime: string | null;
  stopTime: string | null;
  processingLevel: string | null;
  platform: string | null;
  polarization: string | string[] | null;
  flightDirection: string | null;
  beamMode: string | null;
  browse: string[] | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
}

const ASF_MAX = 20;

/** Keyless ASF SearchAPI lookup. Returns raw granules exactly as the API emits them. */
async function fetchAsf(platform: string, bbox: Bbox, signal?: AbortSignal): Promise<AsfGranule[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const url =
    `https://api.daac.asf.alaska.edu/services/search/param` +
    `?platform=${encodeURIComponent(platform)}` +
    `&bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&output=json&maxResults=${ASF_MAX}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ASF HTTP ${res.status}`);
  const json: unknown = await res.json();
  // ASF `output=json` returns [[...granules], {searchHash, ...}]. Defensive against
  // either that shape or a {results:[...]} wrapper, so a future API change degrades gracefully.
  const arr: unknown[] = Array.isArray(json)
    ? (Array.isArray(json[0]) ? (json[0] as unknown[]) : (json as unknown[]))
    : ((json as { results?: unknown[] }).results ?? []);
  return (arr as AsfGranule[]).slice(0, ASF_MAX);
}

const polText = (p: AsfGranule['polarization']): string => (Array.isArray(p) ? p.join(' · ') : (p ?? '—'));
const fmtTime = (t: string | null): string => (t ? `${t.slice(0, 10)} ${t.slice(11, 16)} UTC` : '—');
const thumbFor = (g: AsfGranule): string | null =>
  g.thumbnailUrl ?? (g.browse ?? []).find((b) => /thumb/i.test(b)) ?? (g.browse ?? [])[0] ?? null;

// ── SAMPLE rasters rendered through the smooth canvas renderer (SarCanvas). ──

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
      <div className="text-slate-400">{label}</div>
      <div className="text-lg font-bold text-white">{value}{sub && <span className="ml-1 text-xs font-normal text-slate-500">{sub}</span>}</div>
    </div>
  );
}

export function SarChampion() {
  const { db } = useStore();
  const [aoi, setAoi] = useState<Aoi>(AOIS[0]);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [thr, setThr] = useState(3);
  const [band, setBand] = useState<'L' | 'C'>('L');
  const [catTab, setCatTab] = useState<'NISAR' | 'Sentinel-1'>('NISAR');
  const [catalog, setCatalog] = useState<{ nisar: AsfGranule[]; s1: AsfGranule[] }>({ nisar: [], s1: [] });
  const [catState, setCatState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [catError, setCatError] = useState<string | null>(null);

  // SAMPLE synthetic before/after pair, centred on the chosen AOI (not the live granules).
  const pair = useMemo(
    () => simulateSarPair(scenario, { seed: 7, size: 44, extent: [aoi.lon - 0.4, aoi.lat - 0.32, aoi.lon + 0.4, aoi.lat + 0.32] as Bbox }),
    [scenario, aoi],
  );
  const change = useMemo(() => backscatterChange(pair.before, pair.after, { thresholdDb: thr }), [pair, thr]);
  const classes = useMemo(() => classifyChange(change.diff), [change]);
  const phase = useMemo(() => {
    const w = 44, h = 44;
    const vals = new Array<number>(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2) / (w / 2);
      vals[y * w + x] = 2 * Math.PI * Math.exp(-(d * d) * 3);
    }
    return { width: w, height: h, extent: pair.after.extent, values: vals, quantity: 'phase-rad' as const, unit: 'rad', label: 'Synthetic wrapped phase' };
  }, [pair]);
  const dispMax = useMemo(() => {
    const lambda = band === 'L' ? 0.238 : 0.0555; // NISAR L-band ≈24 cm, Sentinel-1 C-band ≈5.5 cm
    const disp = phaseToDisplacement(phase, lambda);
    return { maxCm: Math.max(...disp.values.map((v) => Math.abs(v))) * 100, lambda };
  }, [phase, band]);
  const related = useMemo(
    () => (db ? relateEvents(aoi.lat, aoi.lon, 500, db.events.map((e) => ({ type: e.type, title: e.title, lat: e.lat, lon: e.lon, t: e.t }))) : []),
    [db, aoi],
  );

  // LIVE ASF catalogue fetch (keyless, per-AOI).
  useEffect(() => {
    const ctrl = new AbortController();
    setCatState('loading');
    setCatError(null);
    (async () => {
      try {
        const [nisar, s1] = await Promise.all([
          fetchAsf('NISAR', aoi.bbox, ctrl.signal),
          fetchAsf('Sentinel-1A', aoi.bbox, ctrl.signal),
        ]);
        if (ctrl.signal.aborted) return;
        setCatalog({ nisar, s1 });
        setCatState('ok');
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setCatError(e instanceof Error ? e.message : String(e));
        setCatState('error');
      }
    })();
    return () => ctrl.abort();
  }, [aoi]);

  const granules = catTab === 'NISAR' ? catalog.nisar : catalog.s1;

  return (
    <div className="space-y-3">
      <PageHeader
        icon="Radio"
        title="SAR Champion"
        subtitle="Dancing with the SARs — detect surface change and measure InSAR displacement, backed by a live ASF acquisition catalogue."
        right={
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={catState === 'ok' ? 'live' : 'not connected'} note={catState === 'ok' ? 'LIVE · ASF catalogue' : catState === 'loading' ? 'fetching ASF…' : 'ASF unavailable'} />
            <StatusBadge status="sample" note="SAMPLE · simulated rasters" />
          </div>
        }
      />

      {/* Single line-of-sight caveat — kept visible, never softened. */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
        <Icon name="TriangleAlert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <span>
          <b className="text-amber-200">Single line-of-sight.</b>{' '}
          InSAR measures motion along the satellite's line of sight only — one 1-D component of the true 3-D displacement.
          It cannot separate vertical subsidence from horizontal motion on its own; that needs a second geometry
          (ascending + descending pairs) or ground truth such as GNSS. No claim of full 3-D motion is made here.
        </span>
      </div>

      {/* ── LIVE acquisition catalogue ─────────────────────────────────── */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-title">Live acquisition catalogue · ASF SearchAPI</div>
            <StatusBadge status={catState === 'ok' ? 'live' : 'not connected'} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Area of interest" className="input !w-auto !py-1" value={aoi.id} onChange={(e) => setAoi(AOIS.find((a) => a.id === e.target.value)!)}>
              {AOIS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              {(['NISAR', 'Sentinel-1'] as const).map((t) => (
                <button key={t} onClick={() => setCatTab(t)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${catTab === t ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-slate-400">
          Fetched live and keyless from the ASF SearchAPI for bbox{' '}
          <code className="text-slate-300">[{aoi.bbox.join(', ')}]</code> (most recent {ASF_MAX} per platform).
          <span className="text-slate-500"> Platform, processing level and polarization below are exactly what the API returned. The Sentinel-1A filter currently returns the newest Sentinel-1C/D OPERA granules — the platform shown per row is the true source.</span>
        </p>

        {catState === 'loading' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><span className="live-dot h-2 w-2 rounded-full bg-emerald-400" />Querying ASF…</div>
        )}
        {catState === 'error' && (
          <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
            Live catalogue unavailable: <b>{catError}</b>. The detector below still runs on SAMPLE rasters.
          </div>
        )}
        {catState === 'ok' && granules.length === 0 && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs text-slate-400">
            No {catTab} acquisitions returned for this AOI in the ASF index. Try a larger or different area.
          </div>
        )}
        {catState === 'ok' && granules.length > 0 && (
          <ul className="scroll-thin mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {granules.map((g, i) => {
              const thumb = thumbFor(g);
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.03] p-2">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md border border-white/10 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5"><Icon name="Satellite" className="h-5 w-5 text-slate-500" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white" title={g.granuleName ?? ''}>{g.granuleName ?? '—'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                      <Chip className="!px-1.5 !py-0 text-slate-200">{g.platform ?? '—'}</Chip>
                      <Chip className="!px-1.5 !py-0 text-slate-200">{g.processingLevel ?? '—'}</Chip>
                      <Chip className="!px-1.5 !py-0 text-slate-200">{polText(g.polarization)}</Chip>
                      {g.flightDirection && <Chip className="!px-1.5 !py-0 text-slate-400">{g.flightDirection}</Chip>}
                      {g.beamMode && <Chip className="!px-1.5 !py-0 text-slate-400">{g.beamMode}</Chip>}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">Acquired {fmtTime(g.startTime)}{g.stopTime ? ` → ${fmtTime(g.stopTime)}` : ''}</div>
                  </div>
                  {g.downloadUrl && (
                    <a href={g.downloadUrl} target="_blank" rel="noreferrer" title="Open granule download" className="shrink-0 text-slate-400 transition hover:text-sky-300">
                      <Icon name="Download" className="h-4 w-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Glass>

      {/* ── Before / after change studio (SAMPLE) ──────────────────────── */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-title">Before / after surface-change studio</div>
            <StatusBadge status="sample" />
          </div>
          <select aria-label="Change scenario" className="input !w-auto !py-1" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {pair.groundTruth} Centred on {aoi.region} ({aoi.lat.toFixed(2)}°, {aoi.lon.toFixed(2)}°) for reference only — not the live granules above.
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Before · σ0 (dB)</div>
            <SarCanvas r={pair.before} palette={ampPalette} />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">After · σ0 (dB)</div>
            <SarCanvas r={pair.after} palette={ampPalette} />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          Detection threshold: <b>{thr} dB</b>
          <input type="range" min={2} max={8} value={thr} onChange={(e) => setThr(+e.target.value)} className="flex-1" />
        </label>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_260px] gap-4">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Change · after − before (dB)</div>
            <SarCanvas r={change.diff} palette={changePalette} />
          </div>
          <div className="space-y-2 text-xs">
            <Stat label="Changed cells" value={String(change.changedCells)} sub={`(${(change.changedPct * 100).toFixed(1)}%)`} />
            <Stat label="Est. affected area" value={`${change.areaKm2.toFixed(0)} km²`} />
            <Stat label="Clusters" value={String(change.clusters)} />
            <div className="space-y-1">
              {classes.map((c) => (
                <div key={c.label} className="rounded-md border border-white/10 p-1.5"><b className="text-teal-200">{c.label}</b><div className="text-slate-400">{c.reasoning}</div></div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">{change.method}</p>
          </div>
        </div>
      </Glass>

      {/* ── InSAR lab (SAMPLE) + live cross-links ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Glass className="p-4">
          <div className="flex items-center justify-between">
            <div className="h-title">InSAR laboratory</div>
            <StatusBadge status="sample" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Synthetic wrapped phase → line-of-sight displacement (λ = {dispMax.lambda.toFixed(3)} m, {band === 'L' ? 'L-band' : 'C-band'}).
            Each colour cycle is one 2π phase wrap; max LOS displacement ≈ <b className="text-white">{dispMax.maxCm.toFixed(1)} cm</b>. LOS only — a single component of 3-D motion.
          </p>
          <div className="mt-2 flex gap-1">
            {(['L', 'C'] as const).map((b) => (
              <button key={b} onClick={() => setBand(b)} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${band === b ? 'border-sky-400/40 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'}`}>
                {b}-band
              </button>
            ))}
          </div>
          <div className="mx-auto mt-3 max-w-[300px]">
            <SarCanvas r={phase} palette={phasePalette} />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Each colour cycle is one 2π phase wrap — concentric rings mean a smooth displacement field. Atmospheric delays, orbit error and phase ambiguity are not modelled here — this is a SAMPLE raster, not a real interferogram.
          </p>
        </Glass>

        <Glass className="p-4">
          <div className="flex items-center justify-between">
            <div className="h-title">Cross-links to live events</div>
            <StatusBadge status={db ? db.status : 'not connected'} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Same area, independent feeds — what did the earthquake/fire/flood catalogues record within 500 km of {aoi.region}?
          </p>
          {related.length ? (
            <ul className="scroll-thin mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
              {related.slice(0, 20).map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-white/10 p-1.5">
                  <span style={{ color: TYPE_META[r.type]?.color }}>{TYPE_META[r.type]?.label ?? r.type}</span>
                  <span className="flex-1 truncate text-slate-200">{r.title}</span>
                  <span className="text-slate-500">{Math.round(r.distKm)} km</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No independent events within 500 km in the current catalogue. That itself is a finding.</p>
          )}
          <p className="mt-2 text-[10px] text-slate-500">
            Radar change is a physical measurement; its cause needs independent evidence. Cross-linking is how a signal becomes a story.
          </p>
        </Glass>
      </div>

      {/* ── Mission / provenance footer ─────────────────────────────────── */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          <Icon name="Database" className="h-4 w-4 text-slate-500" />
          <span className="text-slate-300">Instruments</span>
          {SAR_MISSIONS.map((m) => <Chip key={m.id}>{m.id} · {m.band}-band</Chip>)}
          <span className="ml-auto text-slate-500">Simulated rasters: SAMPLE · Acquisition list: LIVE ASF SearchAPI</span>
        </div>
      </Glass>
    </div>
  );
}
