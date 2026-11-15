import { useEffect, useMemo, useState } from 'react';
import { ZoomableImage } from '../components/ImageViewer';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { JsonPane, Table, ViewSwitch, useDataSheet } from '../components/DataSheet';

/**
 * One real disaster case — Kahramanmaraş M7.8, 6 February 2023.
 *
 * Every panel here is a published product:
 *   - the USGS event record (magnitude, depth, MMI, alert level)
 *   - the USGS ShakeMap (intensity raster, max MMI/PGA, 1 721 reporting stations)
 *   - the real Sentinel-1 GRD quicklook before and after the rupture (NASA ASF)
 *   - the USGS aftershock catalogue, counted by ORBIT (516 events, M≥3)
 *
 * There is deliberately no deformation field: drawing one needs a processed SLC
 * pair, and this build cannot authenticate the download. The panel says that
 * rather than showing a plausible-looking picture.
 */

interface Case {
  generated_at: string;
  event: {
    id: string; title: string; magnitude: number; magnitudeType: string; time: string; place: string;
    depthKm: number; lat: number; lon: number; mmi: number | null; alert: string | null; tsunami: number;
    felt: number | null; significance: number; reviewStatus: string; url: string; source: string;
  };
  aftershocks: {
    window: { from: string; to: string; minMagnitude: number; bbox: number[] };
    count: number;
    counts: { mag: number; count: number }[];
    byDay: { date: string; count: number }[];
    strongest: { magnitude: number; place: string; time: string } | null;
    meanDepthKm: number | null;
    source: string;
    url: string;
  };
  shakemap: {
    available: boolean; source: string; maxMmi: number | null; maxPga: number | null;
    intensityMap: string | null; pgaMap: string | null; contours: string | null;
    stations: { count: number; mmiReadings: number; maxMmi: number | null; pgaReadings: number; maxPga: number | null } | null;
    mapStatus: string | null; reviewStatus: string | null; url: string | null;
  };
  imagery: {
    available: boolean; source: string; pass?: string; error?: string;
    before?: { date: string; time: string; platform: string; image: string; granule: string };
    after?: { date: string; time: string; platform: string; image: string; granule: string };
  };
  provenance: { providers: string[]; access: string; honesty: string };
}

let cache: Case | null = null;

const tUtc = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

function Source({ text, url, at }: { text: string; url?: string | null; at?: string | null }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[9px] text-slate-500">
      <span>{text}</span>
      {at && <span className="text-slate-600">· {at}</span>}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-sky-400/80 hover:underline">
          source ↗
        </a>
      )}
    </div>
  );
}

export function RealQuakeCase() {
  const [data, setData] = useState<Case | null>(cache);
  const [err, setErr] = useState<string | null>(null);
  const sheet = useDataSheet('/data/disaster/kahramanmaras.json');

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch('/data/disaster/kahramanmaras.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: Case) => {
        cache = j;
        if (alive) setData(j);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const peakDay = useMemo(() => Math.max(1, ...(data?.aftershocks.byDay ?? []).map((d) => d.count)), [data]);
  const maxBin = useMemo(() => Math.max(1, ...(data?.aftershocks.counts ?? []).map((c) => c.count)), [data]);

  if (err) {
    return (
      <Glass className="p-4">
        <div className="text-[11px] text-amber-200">
          Case data not loaded ({err}) — run <code className="rounded bg-white/10 px-1">npm run data:quake</code>.
        </div>
      </Glass>
    );
  }
  if (!data) return <Glass className="p-4"><div className="text-[11px] text-slate-400">Loading the USGS record…</div></Glass>;

  const { event, aftershocks, shakemap, imagery } = data;

  return (
    <div className="space-y-3">
      {/* ——— event record ——— */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="Activity" className="h-4 w-4 text-rose-300" />
              <span className="text-[13px] font-semibold text-white">{event.title}</span>
              <StatusBadge status="live" note="usgs catalogue" />
              {event.alert && (
                <span className="rounded border border-rose-400/40 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-300">
                  alert {event.alert}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {event.place} · {event.lat.toFixed(3)}°N {event.lon.toFixed(3)}°E · reviewed {event.reviewStatus}
            </div>
          </div>
          <ViewSwitch
            open={sheet.open}
            setOpen={sheet.setOpen}
            jsonUrl="/data/disaster/kahramanmaras.json"
            csv={{
              head: ['date', 'aftershocks M>=3 in bbox'],
              body: aftershocks.byDay.map((d) => [d.date, d.count]),
            }}
            csvName="orbit-kahramanmaras-aftershocks.csv"
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {[
            { k: 'Magnitude', v: `M${event.magnitude}`, s: event.magnitudeType, tone: 'text-rose-200' },
            { k: 'Depth', v: `${event.depthKm} km`, s: 'USGS hypocentre', tone: 'text-slate-100' },
            { k: 'Max intensity', v: event.mmi ? `MMI ${event.mmi.toFixed(1)}` : '—', s: 'instrumental', tone: 'text-orange-200' },
            { k: 'Felt reports', v: event.felt ? event.felt.toLocaleString('en-US') : '—', s: 'public "Did you feel it?"', tone: 'text-slate-100' },
            { k: 'Origin time', v: tUtc(event.time).slice(0, 16), s: 'UTC', tone: 'text-sky-200' },
          ].map((m) => (
            <div key={m.k} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.08em] text-slate-500">{m.k}</div>
              <div className={`text-[13px] font-semibold leading-tight ${m.tone}`}>{m.v}</div>
              <div className="text-[8px] text-slate-500">{m.s}</div>
            </div>
          ))}
        </div>
        <Source text={`${event.source} · event ${event.id}`} url={event.url} at={`fetched ${tUtc(data.generated_at)}`} />
      </Glass>

      {/* ——— shakemap + real before/after imagery ——— */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Glass className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white">USGS ShakeMap · intensity</span>
            <span className="text-[9px] text-slate-500">{shakemap.reviewStatus ?? 'automatic'} map</span>
          </div>
          {shakemap.available && shakemap.intensityMap ? (
            <>
              <ZoomableImage
                src={shakemap.intensityMap}
                alt="USGS ShakeMap modified Mercalli intensity"
                className="mt-1.5 w-full rounded border border-white/10"
                label="USGS ShakeMap · Kahramanmaraş M7.8"
                caption={'max MMI ' + (shakemap.maxMmi ?? '—') + ' · max PGA ' + (shakemap.maxPga ?? '—') + ' g'}
                source="USGS ShakeMap intensity"
                date="2023-02-06"
                href={shakemap.intensityMap}
              />
              <div className="mt-1 grid grid-cols-3 gap-1">
                <div className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-1">
                  <div className="text-[8px] uppercase text-slate-500">Max MMI</div>
                  <div className="text-[12px] font-semibold text-orange-200">{shakemap.maxMmi?.toFixed(1) ?? '—'}</div>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-1">
                  <div className="text-[8px] uppercase text-slate-500">Max PGA</div>
                  <div className="text-[12px] font-semibold text-slate-100">{shakemap.maxPga ? `${shakemap.maxPga.toFixed(2)} g` : '—'}</div>
                </div>
                <div className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-1">
                  <div className="text-[8px] uppercase text-slate-500">Stations</div>
                  <div className="text-[12px] font-semibold text-slate-100">{shakemap.stations?.count?.toLocaleString('en-US') ?? '—'}</div>
                </div>
              </div>
              <Source
                text={`${shakemap.source} · ${shakemap.stations?.mmiReadings ?? 0} MMI readings, max station MMI ${shakemap.stations?.maxMmi ?? '—'}`}
                url={shakemap.url ?? shakemap.intensityMap}
                at={`fetched ${tUtc(data.generated_at)}`}
              />
            </>
          ) : (
            <div className="mt-1.5 text-[11px] text-amber-200">ShakeMap product unavailable for this event.</div>
          )}
        </Glass>

        <Glass className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white">Sentinel-1 radar · before / after the rupture</span>
            <span className="text-[9px] text-slate-500">{imagery.pass?.toLowerCase() ?? ''} pass</span>
          </div>
          {imagery.available && imagery.before && imagery.after ? (
            <>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {([['before', imagery.before, 'text-amber-300'], ['after', imagery.after, 'text-cyan-300']] as const).map(([kind, g, tone]) => (
                  <div key={kind} className="rounded-lg border border-white/10 bg-slate-950/50 p-1">
                    <div className="flex items-center justify-between px-0.5">
                      <span className={`text-[9px] font-semibold uppercase ${tone}`}>{kind}</span>
                      <span className="text-[9px] text-slate-500">{g.date}</span>
                    </div>
                    <ZoomableImage
                      src={g.image}
                      alt={'Sentinel-1 ' + kind + ' quicklook ' + g.date}
                      className="mt-1 h-[150px] w-full rounded"
                      label={'Kahramanmaraş · Sentinel-1 ' + kind}
                      caption={g.platform + ' · ' + g.time + ' UTC'}
                      source="NASA ASF"
                      date={g.date}
                      href={g.granule}
                      before={imagery.before ? { src: imagery.before.image, label: 'Sentinel-1 before', date: imagery.before.date, source: 'NASA ASF' } : undefined}
                      after={imagery.after ? { src: imagery.after.image, label: 'Sentinel-1 after', date: imagery.after.date, source: 'NASA ASF' } : undefined}
                    />
                    <div className="mt-0.5 truncate px-0.5 text-[8px] text-slate-500">{g.platform} · {g.time}</div>
                  </div>
                ))}
              </div>
              <Source text="NASA ASF · Sentinel-1 GRD quicklooks (browse images — no pixel values are read here)" url={imagery.after.granule} at={`${imagery.before.date} → ${imagery.after.date}`} />
            </>
          ) : (
            <div className="mt-1.5 text-[11px] text-amber-200">
              No matched before/after pass for this point: {imagery.error ?? 'ASF returned no pair'}.
            </div>
          )}
          <p className="mt-1 text-[9px] leading-snug text-slate-500">
            No deformation field is drawn. A line-of-sight displacement needs a processed SLC pair (NISAR L2 or Sentinel-1 SLC),
            which this build cannot authenticate — the honest output here is the imagery and the catalogue, not a computed fringe.
          </p>
        </Glass>
      </div>

      {/* ——— aftershock catalogue ——— */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-white">Aftershock sequence · counted from the catalogue</div>
            <div className="text-[10px] text-slate-400">
              M≥{aftershocks.window.minMagnitude} inside {aftershocks.window.bbox[0]}–{aftershocks.window.bbox[2]}°E,{' '}
              {aftershocks.window.bbox[1]}–{aftershocks.window.bbox[3]}°N · {aftershocks.window.from} → {aftershocks.window.to}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-slate-300">
              <b className="text-white">{aftershocks.count}</b> events
            </span>
            {aftershocks.strongest && (
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-slate-300">
                largest <b className="text-white">M{aftershocks.strongest.magnitude}</b>
              </span>
            )}
            <span className="rounded border border-white/10 px-1.5 py-0.5 text-slate-300">
              mean depth <b className="text-white">{aftershocks.meanDepthKm ?? '—'} km</b>
            </span>
          </div>
        </div>

        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Events per day</div>
            <svg viewBox="0 0 520 96" className="mt-1 w-full" role="img" aria-label="aftershocks per day">
              {aftershocks.byDay.map((d, i) => {
                const w = 520 / Math.max(aftershocks.byDay.length, 1);
                const h = (d.count / peakDay) * 76;
                return (
                  <g key={d.date}>
                    <rect x={i * w + 0.5} y={80 - h} width={Math.max(w - 1, 0.8)} height={h} fill="#f472b6" fillOpacity="0.75" />
                    <title>{`${d.date}: ${d.count} events`}</title>
                  </g>
                );
              })}
              <line x1="0" y1="80" x2="520" y2="80" stroke="#334155" strokeWidth="0.7" />
              <text x="0" y="92" fill="#475569" fontSize="8">{aftershocks.byDay[0]?.date}</text>
              <text x="520" y="92" textAnchor="end" fill="#475569" fontSize="8">{aftershocks.byDay[aftershocks.byDay.length - 1]?.date}</text>
              <text x="0" y="10" fill="#64748b" fontSize="8">peak {peakDay}/day</text>
            </svg>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Magnitude distribution</div>
            <div className="mt-1 space-y-1">
              {aftershocks.counts.map((c) => (
                <div key={c.mag} className="flex items-center gap-1.5">
                  <span className="w-8 shrink-0 text-right font-mono text-[9px] text-slate-400">M{c.mag}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-white/5">
                    <div className="h-2 rounded bg-rose-400/70" style={{ width: `${(c.count / maxBin) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 font-mono text-[9px] text-slate-300">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {sheet.open === 'table' && (
          <Table
            head={['Date (UTC)', 'Aftershocks M≥3']}
            body={aftershocks.byDay.map((d) => [d.date, d.count])}
          />
        )}
        {sheet.open === 'json' && <JsonPane raw={sheet.raw} err={sheet.err} url="/data/disaster/kahramanmaras.json" />}

        <Source text={aftershocks.source} url={aftershocks.url} at={`fetched ${tUtc(data.generated_at)}`} />
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Chip>USGS catalogue</Chip>
          <Chip>USGS ShakeMap</Chip>
          <Chip>NASA ASF Sentinel-1</Chip>
          <Chip>keyless</Chip>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-slate-500">{data.provenance.honesty}</p>
      </Glass>
    </div>
  );
}

export default RealQuakeCase;
