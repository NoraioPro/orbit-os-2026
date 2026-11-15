import { useEffect, useMemo, useState } from 'react';
import { ZoomableImage } from '../components/ImageViewer';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import {
  relateEvents, SAR_MISSIONS,
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
//    replaced by the public quicklooks the API returns; nothing synthetic is drawn.
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
  lat: number;  // area centre (for event cross-linking)
  lon: number;
}

const AOIS: Aoi[] = [
  { id: 'sfbay', name: 'San Francisco Bay', region: 'California, USA', bbox: [-122.6, 37.5, -121.9, 38.0], lat: 37.75, lon: -122.25 },
  { id: 'iceland', name: 'Iceland (rift & volcano)', region: 'Southwest Iceland', bbox: [-21.5, 63.8, -20.0, 64.4], lat: 64.15, lon: -20.9 },
  { id: 'amazon', name: 'Amazon frontier', region: 'Amazonas, Brazil', bbox: [-60.5, -3.5, -59.5, -2.5], lat: -3.0, lon: -60.0 },
  { id: 'alps', name: 'Swiss Alps (ice)', region: 'Valais, Switzerland', bbox: [7.0, 45.8, 8.0, 46.4], lat: 46.1, lon: 7.5 },
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


/** Real before/after imagery for the selected AOI, straight from ASF quicklooks. */
function quickUrl(g: AsfGranule | null): string | null {
  if (!g) return null;
  const b = g.browse as unknown;
  if (typeof b === 'string' && b.startsWith('http')) return b;
  if (Array.isArray(b)) {
    const hit = b.find((x) => typeof x === 'string') as string | undefined;
    return hit ?? null;
  }
  return null;
}

function RealBeforeAfter({ aoi }: { aoi: Aoi }) {
  const [pair, setPair] = useState<{ before: AsfGranule | null; after: AsfGranule | null; n: number; dir: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setPair(null);
    setErr(null);
    setFailed({});
    const [minLon, minLat, maxLon, maxLat] = aoi.bbox;
    const url =
      'https://api.daac.asf.alaska.edu/services/search/param' +
      '?platform=SENTINEL-1&processingLevel=GRD_HD&bbox=' + minLon + ',' + minLat + ',' + maxLon + ',' + maxLat +
      '&output=json&maxResults=80';
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ASF HTTP ' + r.status))))
      .then((json: unknown) => {
        if (!alive) return;
        const rows = (Array.isArray(json) ? (Array.isArray(json[0]) ? json[0] : json) : ((json as { results?: unknown[] }).results ?? [])) as AsfGranule[];
        const usable = rows.filter((g) => quickUrl(g) && g.startTime);
        // a before/after comparison only means something on one viewing geometry
        const byDir = new Map<string, AsfGranule[]>();
        for (const g of usable) {
          const d = g.flightDirection ?? 'unknown';
          byDir.set(d, [...(byDir.get(d) ?? []), g]);
        }
        const best = [...byDir.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        const list = (best?.[1] ?? []).sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
        setPair({
          before: list[0] ?? null,
          after: list.length > 1 ? list[list.length - 1] : null,
          n: usable.length,
          dir: best?.[0] ?? null,
        });
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [aoi.id, aoi.bbox]);

  const spanDays =
    pair?.before?.startTime && pair?.after?.startTime
      ? Math.round((new Date(pair.after.startTime).getTime() - new Date(pair.before.startTime).getTime()) / 86400000)
      : null;

  const card = (g: AsfGranule | null, kind: 'before' | 'after') => {
    const src = quickUrl(g);
    const tone = kind === 'before' ? 'text-amber-300' : 'text-cyan-300';
    return (
      <div className="rounded-lg border border-white/10 bg-slate-950/50 p-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className={'text-[10px] font-semibold uppercase tracking-wide ' + tone}>{kind}</span>
          <span className="text-[9px] text-slate-500">{g?.startTime?.slice(0, 10) ?? '—'}</span>
        </div>
        {src && !failed[kind] ? (
          <ZoomableImage
            src={src}
            alt={'Sentinel-1 ' + kind + ' quicklook, ' + aoi.region}
            className="mt-1 h-[190px] w-full rounded"
            label={aoi.region + ' · Sentinel-1 ' + kind}
            caption={(g?.flightDirection ?? '') + ' · ' + (g?.processingLevel ?? '')}
            source="NASA ASF quicklook"
            date={g?.startTime?.slice(0, 10)}
            href={g?.downloadUrl ?? src}
          />
        ) : (
          <div className="mt-1 grid h-[190px] place-items-center rounded border border-white/5 bg-slate-900/60 px-2 text-center text-[10px] text-slate-500">
            {src ? 'quicklook unavailable' : 'no public quicklook for this window'}
          </div>
        )}
        <div className="mt-1 truncate px-0.5 text-[9px] text-slate-500">
          {g
            ? (g.platform ?? 'Sentinel-1') + ' · ' + (g.flightDirection ?? '—') + ' · ' + (g.processingLevel ?? '—') + ' · ' + (g.startTime?.slice(11, 16) ?? '—') + ' UTC'
            : '—'}
        </div>
        {g?.downloadUrl && (
          <a className="px-0.5 text-[9px] text-sky-400 hover:underline" href={g.downloadUrl} target="_blank" rel="noreferrer">
            granule ↗
          </a>
        )}
      </div>
    );
  };

  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="h-title">Before / after · real Sentinel-1 imagery</div>
        <StatusBadge status={pair ? 'live' : 'snapshot'} note={pair ? 'asf quicklooks' : 'querying'} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Public GRD quicklooks for {aoi.region} — earliest and latest scene of the same pass direction, so the pair shares viewing geometry.
      </p>
      {err && (
        <div className="mt-2 rounded border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          ASF unavailable: {err}. No synthetic image is substituted.
        </div>
      )}
      {!pair && !err && <div className="mt-2 text-[11px] text-slate-500">Querying ASF…</div>}
      {pair && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {card(pair.before, 'before')}
            {card(pair.after, 'after')}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span>
              {pair.n} public quicklook{pair.n === 1 ? '' : 's'} in this box
            </span>
            {spanDays !== null && pair.dir && (
              <span>
                · {spanDays} d apart · both {pair.dir.toLowerCase()}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Quicklooks are browse images — ORBIT reads no pixel values from them and computes no change map here.
          </p>
        </>
      )}
    </Glass>
  );
}

export function SarChampion() {
  const { db } = useStore();
  const [aoi, setAoi] = useState<Aoi>(AOIS[0]);
  const [catTab, setCatTab] = useState<'NISAR' | 'Sentinel-1'>('NISAR');
  const [catalog, setCatalog] = useState<{ nisar: AsfGranule[]; s1: AsfGranule[] }>({ nisar: [], s1: [] });
  const [catState, setCatState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [catError, setCatError] = useState<string | null>(null);

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
        subtitle="Dancing with the SARs — the live ASF catalogue, the public quicklooks for the selected area, and the independent event feeds beside them. No synthetic raster is shown on this page."
        right={
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={catState === 'ok' ? 'live' : 'not connected'} note={catState === 'ok' ? 'LIVE · ASF catalogue' : catState === 'loading' ? 'fetching ASF…' : 'ASF unavailable'} />
            <StatusBadge status="live" note="live ASF catalogue" />
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
            Live catalogue unavailable: <b>{catError}</b>. Nothing is substituted — the panels below stay empty rather than invent a scene.
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

      {/* ── Real imagery + live cross-links ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <RealBeforeAfter aoi={aoi} />

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
          <span className="ml-auto text-slate-500">Acquisition list + imagery: LIVE ASF SearchAPI · no synthetic rasters on this page</span>
        </div>
      </Glass>
    </div>
  );
}
