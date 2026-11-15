import { useEffect, useMemo, useState } from 'react';
import { ZoomableImage } from '../components/ImageViewer';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';

/**
 * 30 m imagery for one AOI, replacing the 250 m MODIS NDVI view.
 *
 * The catalogue is built by scripts/build-hires.mjs, which asks NASA GIBS which
 * dates actually have coverage over the AOI — so every date chip in this panel
 * returned a real tile at build time. Switching layer or date re-requests the same
 * extent from GIBS; nothing is interpolated, and no pixel statistic is computed
 * from the imagery (the series next to this panel come from NASA POWER).
 */

const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

interface LayerSpec {
  id: string;
  label: string;
  short: string;
  gibs: string;
  resolution: number;
  sensor: string;
  format: string;
  transparent?: boolean;
  legend?: string;
  caveat?: string;
  dates: string[];
  tested: number;
}

interface AoiSpec {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  layers: LayerSpec[];
  reference: LayerSpec;
}

interface Catalogue {
  generated_at: string;
  provenance: { honesty: string; provider: string; url: string };
  aois: AoiSpec[];
}

let cache: Catalogue | null = null;
let inflight: Promise<Catalogue> | null = null;

function loadCatalogue(): Promise<Catalogue> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/data/domains/hires.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: Catalogue) => {
        cache = j;
        return j;
      })
      .catch((e: Error) => {
        inflight = null;
        throw e;
      });
  }
  return inflight;
}

function imageUrl(layer: Pick<LayerSpec, 'gibs' | 'format' | 'transparent'>, date: string, bbox: number[], size = 640) {
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: layer.gibs,
    STYLES: 'default',
    FORMAT: layer.format,
    TRANSPARENT: layer.transparent ? 'TRUE' : 'FALSE',
    HEIGHT: String(size),
    WIDTH: String(size),
    SRS: 'EPSG:4326',
    BBOX: bbox.join(','),
    TIME: date,
  });
  return `${WMS}?${q.toString()}`;
}

export function HiResImagery({ aoiId, compact = false }: { aoiId: string; compact?: boolean }) {
  const [cat, setCat] = useState<Catalogue | null>(cache);
  const [err, setErr] = useState<string | null>(null);
  const [layerId, setLayerId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadCatalogue()
      .then((c) => alive && setCat(c))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const aoi = useMemo(() => cat?.aois.find((a) => a.id === aoiId) ?? null, [cat, aoiId]);
  const layer = useMemo(() => {
    if (!aoi) return null;
    return aoi.layers.find((l) => l.id === layerId) ?? aoi.layers[0] ?? null;
  }, [aoi, layerId]);

  // reset the date whenever the layer changes, and never keep a date the layer lacks
  useEffect(() => {
    if (!layer) return;
    if (!date || !layer.dates.includes(date)) setDate(layer.dates[layer.dates.length - 1] ?? null);
  }, [layer, date]);

  useEffect(() => setFailed(false), [layerId, date]);

  if (err) {
    return (
      <Glass className="p-3">
        <div className="text-[11px] text-amber-200">30 m catalogue unavailable ({err}). No imagery is substituted.</div>
      </Glass>
    );
  }
  if (!cat || !aoi || !layer) {
    return (
      <Glass className="p-3">
        <div className="text-[11px] text-slate-400">Loading the 30 m imagery catalogue…</div>
      </Glass>
    );
  }

  const refDate = aoi.reference.dates[aoi.reference.dates.length - 1] ?? null;
  const imgH = compact ? 'h-[190px]' : 'h-[300px]';

  return (
    <Glass className="overflow-hidden p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white">
            High-resolution imagery · {aoi.name}
          </div>
          <div className="text-[9px] text-slate-400">
            Harmonized Landsat / Sentinel-2 + OPERA · {layer.resolution} m/px · replaces the 250 m MODIS NDVI view
          </div>
        </div>
        <StatusBadge status="live" note="gibs wms" />
      </div>

      {/* layer filter */}
      <div className="mt-2 flex flex-wrap gap-1">
        {aoi.layers.map((l) => {
          const on = l.id === layer.id;
          const empty = l.dates.length === 0;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLayerId(l.id)}
              disabled={empty}
              className={`rounded border px-1.5 py-0.5 text-[9px] transition ${
                on
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : empty
                    ? 'border-white/5 text-slate-600'
                    : 'border-white/10 text-slate-300 hover:border-white/25'
              }`}
              title={empty ? 'no dated coverage in the last 90 days' : l.label}
            >
              {l.short}
            </button>
          );
        })}
      </div>

      {/* date filter — only dates that had a real tile at build time */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {layer.dates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] transition ${
              d === date ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {d.slice(5)}
          </button>
        ))}
        {layer.dates.length === 0 && <span className="text-[9px] text-slate-500">no dated coverage</span>}
      </div>

      <div className={`mt-2 grid gap-1.5 ${compare ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="relative">
          {date && !failed ? (
            <ZoomableImage
              src={imageUrl(layer, date, aoi.bbox)}
              alt={layer.label + ' over ' + aoi.name + ', ' + (date ?? '')}
              className={'w-full rounded ' + imgH}
              label={layer.label + ' · ' + aoi.name}
              caption={layer.resolution + ' m/px · GIBS WMS'}
              source={layer.sensor}
              date={date ?? undefined}
              href={imageUrl(layer, date ?? '', aoi.bbox, 2048)}
            />
          ) : (
            <div className={`grid w-full place-items-center rounded border border-white/5 bg-slate-900/60 px-2 text-center text-[10px] text-slate-500 ${imgH}`}>
              {failed ? 'GIBS returned no image for this date' : 'no date selected'}
            </div>
          )}
          <div className="pointer-events-none absolute left-1 top-1 rounded bg-slate-950/75 px-1 py-0.5 text-[9px] text-slate-200">
            {layer.resolution} m · {date ?? '—'}
          </div>
        </div>
        {compare && refDate && (
          <div className="relative">
            <ZoomableImage
              src={imageUrl(aoi.reference, refDate, aoi.bbox)}
              alt={'MODIS reference over ' + aoi.name}
              className={'w-full rounded ' + imgH}
              label={'MODIS 250 m reference · ' + aoi.name}
              caption="the coarser layer, for scale comparison"
              source={aoi.reference.sensor}
              date={refDate ?? undefined}
            />
            <div className="pointer-events-none absolute left-1 top-1 rounded bg-slate-950/75 px-1 py-0.5 text-[9px] text-amber-200">
              MODIS 250 m · {refDate}
            </div>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCompare((c) => !c)}
          className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 transition hover:border-white/25"
        >
          {compare ? 'hide MODIS 250 m comparison' : 'compare with MODIS 250 m'}
        </button>
        {layer.legend && (
          <a
            className="text-[9px] text-sky-400 hover:underline"
            href={layer.legend}
            target="_blank"
            rel="noreferrer"
          >
            layer legend ↗
          </a>
        )}
        <a
          className="text-[9px] text-sky-400 hover:underline"
          href={`https://gibs.earthdata.nasa.gov/worldview/worldview.html?l=${layer.gibs}&t=${date}&z=7`}
          target="_blank"
          rel="noreferrer"
        >
          open in GIBS Worldview ↗
        </a>
      </div>

      <div className="mt-1 text-[9px] leading-snug text-slate-500">
        {layer.sensor} · {layer.dates.length} dated tile{layer.dates.length === 1 ? '' : 's'} of {layer.tested} probed.
        {layer.caveat ? ` ${layer.caveat}` : ''} Imagery only — no reflectance or NDVI value is read from these pixels.
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Chip>
          <Icon name="Satellite" className="h-3 w-3" />
          {layer.resolution} m
        </Chip>
        <Chip>catalogue {cat.generated_at.slice(0, 10)}</Chip>
      </div>
    </Glass>
  );
}

export default HiResImagery;
