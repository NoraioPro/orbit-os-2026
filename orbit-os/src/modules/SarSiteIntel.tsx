import { useEffect, useState } from 'react';
import { Chip, Icon, StatusBadge } from '../components/ui';
import { ZoomableImage } from '../components/ImageViewer';

/**
 * What is actually over this site, per sensor, with before/after imagery.
 *
 * Everything here is fetched live from the NASA ASF Search API (keyless) for the
 * clicked study area:
 *   - Sentinel-1 GRD_HD scenes carry a public full-size quicklook JPEG  -> the
 *     before/after pair on screen is real radar imagery of that site.
 *   - NISAR and Sentinel-1 SLC records give the sensor inventory; their PRODUCT
 *     downloads need an Earthdata login, and NISAR browse images 303 to a login
 *     wall, so no NISAR picture is shown rather than a broken frame.
 *
 * The change percentage on the parent panel stays SAMPLE — this panel does not
 * compute change, it shows what was actually acquired.
 */

interface Site { id: string; name: string; region: string; lat: number; lon: number }

interface Granule {
  granuleName?: string | null;
  platform?: string | null;
  startTime?: string | null;
  flightDirection?: string | null;
  processingLevel?: string | null;
  beamModeType?: string | null;
  polarization?: string | null;
  relativeOrbit?: number | null;
  frameNumber?: number | null;
  browse?: string | string[] | null;
  thumbnailUrl?: string | null;
  downloadUrl?: string | null;
}

const cache = new Map<string, { s1: Granule[]; slc: Granule[]; nisar: Granule[] }>();

const asf = (params: Record<string, string>) =>
  `https://api.daac.asf.alaska.edu/services/search/param?${new URLSearchParams({ output: 'json', ...params }).toString()}`;

async function query(params: Record<string, string>): Promise<Granule[]> {
  try {
    const r = await fetch(asf(params), { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    const rows = Array.isArray(j) ? (Array.isArray(j[0]) ? j[0] : j) : (j?.results ?? []);
    return (rows as Granule[]).filter(Boolean);
  } catch {
    return [];
  }
}

const quicklookOf = (g?: Granule | null) => {
  if (!g) return null;
  if (typeof g.browse === 'string' && g.browse.startsWith('http')) return g.browse;
  if (Array.isArray(g.browse) && typeof g.browse[0] === 'string') return g.browse[0];
  return null;
};

const fmtDay = (s?: string | null) => (s ? s.slice(0, 10) : '—');
const fmtTime = (s?: string | null) => (s ? s.replace('T', ' ').replace('Z', ' UTC').slice(0, 19) : '—');

function SensorRow({ label, band, granules, note }: { label: string; band: string; granules: Granule[]; note: string }) {
  const latest = granules.map((g) => g.startTime).filter(Boolean).sort().pop() ?? null;
  const on = granules.length > 0;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-500'}`}>
        <Icon name={on ? 'CircleCheck' : 'Circle'} className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-slate-200">
          {label} <span className="text-slate-500">({band})</span>
        </div>
        <div className="truncate text-[9px] text-slate-500">{on ? `${granules.length} granule${granules.length === 1 ? '' : 's'} · latest ${fmtDay(latest)} · ${note}` : `no granule · ${note}`}</div>
      </div>
      <span className={`shrink-0 text-[9px] font-semibold uppercase ${on ? 'text-emerald-300' : 'text-slate-500'}`}>{on ? 'real' : 'none'}</span>
    </div>
  );
}

function ImageryCard({ g, kind }: { g: Granule | null; kind: 'before' | 'after' }) {
  const src = quicklookOf(g);
  const [failed, setFailed] = useState(false);
  const tone = kind === 'before' ? 'text-amber-300' : 'text-cyan-300';
  const ring = kind === 'before' ? 'border-amber-400/25' : 'border-cyan-400/25';
  return (
    <div className={`rounded-lg border ${ring} bg-slate-950/50 p-1.5`}>
      <div className="flex items-center justify-between gap-1 px-0.5">
        <span className={`text-[9px] font-semibold uppercase ${tone}`}>{kind}</span>
        <span className="text-[9px] text-slate-500">{fmtDay(g?.startTime)}</span>
      </div>
      {src && !failed ? (
        <ZoomableImage
          src={src}
          alt={`Sentinel-1 ${kind} quicklook ${fmtDay(g?.startTime)}`}
          className="mt-1 h-[168px] w-full rounded"
          label={`Sentinel-1 ${kind} · ${fmtDay(g?.startTime)}`}
          caption={`${g?.platform ?? 'Sentinel-1'} ${g?.flightDirection ?? ''} ${g?.processingLevel ?? ''}`.trim()}
          source={`NASA ASF quicklook · ${kind} pass`}
          date={fmtDay(g?.startTime)}
          href={g?.downloadUrl ?? src}
        />
      ) : (
        <div className="mt-1 grid h-[168px] place-items-center rounded border border-white/5 bg-slate-900/60 text-[9px] text-slate-500">
          {src ? 'quicklook unavailable' : 'no quicklook'}
        </div>
      )}
      <div className="mt-1 truncate px-0.5 text-[9px] text-slate-500" title={g?.granuleName ?? ''}>
        {g ? `${g.platform ?? 'Sentinel-1'} · ${g.flightDirection ?? '—'} · ${g.processingLevel ?? '—'} · ${fmtTime(g.startTime).slice(11, 16)}` : '—'}
      </div>
    </div>
  );
}

export function SarSiteIntel({ site }: { site: Site }) {
  const [data, setData] = useState<{ s1: Granule[]; slc: Granule[]; nisar: Granule[] } | null>(cache.get(site.id) ?? null);
  const [loading, setLoading] = useState(!cache.has(site.id));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const hit = cache.get(site.id);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setErr(null);
    setData(null);
    const point = { intersectsWith: `POINT(${site.lon} ${site.lat})` };
    Promise.all([
      query({ platform: 'SENTINEL-1', processingLevel: 'GRD_HD', maxResults: '40', ...point }),
      query({ platform: 'SENTINEL-1', processingLevel: 'SLC', maxResults: '8', ...point }),
      query({ platform: 'NISAR', maxResults: '8', ...point }),
    ])
      .then(([s1, slc, nisar]) => {
        if (!alive) return;
        const out = { s1, slc, nisar };
        cache.set(site.id, out);
        setData(out);
        if (!s1.length && !slc.length && !nisar.length) setErr('ASF returned no records for this point.');
      })
      .catch((e: Error) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [site.id, site.lat, site.lon]);

  // A before/after comparison is only meaningful on the same viewing geometry,
  // so pick the flight direction with the most scenes and take the earliest and
  // latest within it — never compare an ascending pass with a descending one.
  const usable = (data?.s1 ?? []).filter((g) => quicklookOf(g) && g.startTime);
  const byDir = new Map<string, Granule[]>();
  for (const g of usable) {
    const d = g.flightDirection ?? 'unknown';
    byDir.set(d, [...(byDir.get(d) ?? []), g]);
  }
  const bestDir = [...byDir.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null;
  const pairs = (bestDir ? byDir.get(bestDir) ?? [] : []).sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
  const before = pairs[0] ?? null;
  const after = pairs.length > 1 ? pairs[pairs.length - 1] : null;
  const spanDays = before && after ? Math.round((new Date(after.startTime!).getTime() - new Date(before.startTime!).getTime()) / 86400000) : null;

  return (
    <div className="rounded-lg border border-teal-400/20 bg-teal-500/[0.04] p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.1em] text-teal-200">Real acquisitions over this site</span>
        <StatusBadge status={data ? 'live' : 'snapshot'} note={data ? 'asf query' : 'querying'} />
      </div>

      {loading && <div className="mt-1.5 text-[10px] text-slate-400">Querying ASF for {site.name}…</div>}
      {err && <div className="mt-1.5 text-[10px] text-amber-300">{err}</div>}

      {data && (
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-1">
            <SensorRow label="Sentinel-1 C-band" band="GRD" granules={data.s1} note="imagery · public quicklook" />
            <SensorRow label="Sentinel-1 C-band" band="SLC" granules={data.slc} note="interferometry input · download needs login" />
            <SensorRow label="NISAR" band="L-band" granules={data.nisar} note="product download needs login" />
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <Chip><Icon name="Database" className="h-3 w-3" />ASF Search · keyless</Chip>
              <Chip>{site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°</Chip>
              <span className="text-[9px] text-slate-500">
                {spanDays !== null && bestDir ? `${spanDays} d apart · both ${bestDir.toLowerCase()} passes` : ''}
              </span>
            </div>
          </div>

          {before && after ? (
            <>
              <ImageryCard g={before} kind="before" />
              <ImageryCard g={after} kind="after" />
            </>
          ) : (
            <div className="col-span-2 self-center text-[10px] text-slate-500">
              ASF returned {pairs.length} public quicklook{pairs.length === 1 ? '' : 's'} for this point — not enough for a before/after pair.
            </div>
          )}
        </div>
      )}

      {data && before && after && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
          {before?.downloadUrl && <a className="text-sky-400 hover:underline" href={before.downloadUrl} target="_blank" rel="noreferrer">before granule ↗</a>}
          {after?.downloadUrl && <a className="text-sky-400 hover:underline" href={after.downloadUrl} target="_blank" rel="noreferrer">after granule ↗</a>}
          <a className="text-sky-400 hover:underline" href={asf({ platform: 'SENTINEL-1', processingLevel: 'GRD_HD', maxResults: '40', intersectsWith: `POINT(${site.lon} ${site.lat})` })} target="_blank" rel="noreferrer">ASF search ↗</a>
          <span>quicklooks are browse images — no pixel values are read</span>
        </div>
      )}

    </div>
  );
}
