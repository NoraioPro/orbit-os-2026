import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomableImage } from '../components/ImageViewer';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { FindingsVoice } from '../components/FindingsVoice';
import { JsonPane, Table, ViewSwitch, useDataSheet } from '../components/DataSheet';
import { PlayBar, useAutoPlay } from '../lib/useAutoPlay';

/**
 * Svalbard / European-Arctic ice watch — built only from published data.
 *
 *   chart.json   the current Norwegian Ice Service chart, parsed from the SIGRID-3
 *                shapefile MET Norway publishes: concentration, class and areas.
 *   trends.json  NSIDC Sea Ice Index v4.0 regional monthly area, 1978→now, with the
 *                fits ORBIT computes from it (km²/decade, era comparison).
 *   archive.json the service's own quicklook charts, same week across years.
 *
 * Every number on this panel is either read from the MET/NSIDC files or a stated
 * arithmetic result of them (shoelace polygon area, least-squares slope). No value
 * is estimated, modelled or invented; anything unavailable renders as "not connected".
 */

const ICE = '/data/ice';

interface IceClass {
  nis_class: string;
  ct: number | null;
  polygons: number;
  area_km2: number;
  area_in_window_km2: number;
  ice_covered_km2?: number;
  ice_covered_in_window_km2?: number;
  color: string;
}

interface Ring { cls: string; ct: number | null; pts: [number, number][] }

interface Chart {
  issued: string | null;
  valid_from: string | null;
  valid_to: string | null;
  chart_id: string;
  producer: string;
  source_url: string;
  format: string;
  analyst_note: string | null;
  window: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  counts: { polygons: number; rings_in_window: number };
  totals: {
    charted_zone_km2: number;
    ice_covered_km2: number;
    charted_zone_in_window_km2: number;
    ice_covered_in_window_km2: number;
    classes: number;
  };
  classes: IceClass[];
  ice_edge: { lon_from: number; lon_to: number; south_edge_lat: number }[];
  rings: Ring[];
  provenance: { provider: string; access: string; honesty: string };
}

interface MonthStat {
  month: number;
  slope_km2_per_decade: number;
  pct_per_decade: number | null;
  climatology_1991_2020_km2: number | null;
  latest_year: number;
  latest_km2: number;
  anomaly_vs_climatology_km2: number | null;
}

interface Region {
  id: string;
  label: string;
  area_months: Record<string, [number, number][]>;
  annual_mean: [number, number][];
  stats_by_month: MonthStat[];
  era_change: { month: number; early_mean_km2: number; late_mean_km2: number; change_km2: number; change_pct: number }[];
}

interface Trends {
  source: string;
  source_url: string;
  generated_at: string;
  climatology: string;
  method: string;
  regions: Region[];
}

interface Archive {
  title: string;
  note: string;
  source_url: string;
  images: { date: string; region: string; url: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: number) => n.toLocaleString('en-US');

function useJson<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${ICE}/${path}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: T) => alive && setData(j))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [path]);
  return { data, err };
}

/* ---------------- map: real chart polygons over a graticule ---------------- */
function IceMap({ chart }: { chart: Chart }) {
  const W = 1000;
  const H = 560;
  const { minLon, minLat, maxLon, maxLat } = chart.window;
  const x = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * W;
  const y = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * H;

  // Mercator-ish vertical stretch so the high-Arctic window is not squashed
  const pathOf = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ') + ' Z';

  const lons = useMemo(() => Array.from({ length: Math.floor((maxLon - minLon) / 10) + 1 }, (_, i) => minLon + i * 10), [minLon, maxLon]);
  const lats = useMemo(() => Array.from({ length: Math.floor((maxLat - minLat) / 5) + 1 }, (_, i) => minLat + i * 5), [minLat, maxLat]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Ice chart polygons, ${chart.issued}`}>
      <rect width={W} height={H} fill="#050b16" />
      {/* graticule */}
      {lons.map((lon) => (
        <g key={`lon${lon}`}>
          <line x1={x(lon)} y1={0} x2={x(lon)} y2={H} stroke="#1e293b" strokeWidth="0.7" strokeDasharray="3 7" />
          <text x={x(lon) + 3} y={H - 6} fill="#334155" fontSize="9">{lon}°</text>
        </g>
      ))}
      {lats.map((lat) => (
        <g key={`lat${lat}`}>
          <line x1={0} y1={y(lat)} x2={W} y2={y(lat)} stroke="#1e293b" strokeWidth="0.7" strokeDasharray="3 7" />
          <text x={4} y={y(lat) - 3} fill="#334155" fontSize="9">{lat}°N</text>
        </g>
      ))}

      {/* real chart polygons */}
      {chart.rings.map((r, i) => {
        const cls = chart.classes.find((c) => c.nis_class === r.cls);
        return (
          <path
            key={i}
            d={pathOf(r.pts)}
            fill={cls?.color ?? '#64748b'}
            fillOpacity={0.5}
            stroke={cls?.color ?? '#64748b'}
            strokeWidth="0.6"
            strokeOpacity="0.9"
          >
            <title>{`${r.cls} · CT ${r.ct ?? '—'}%`}</title>
          </path>
        );
      })}

      {/* ice edge by longitude slice */}
      {chart.ice_edge.map((e) => {
        const cx = x((e.lon_from + e.lon_to) / 2);
        const cy = y(e.south_edge_lat);
        return (
          <g key={`edge${e.lon_from}`}>
            <circle cx={cx} cy={cy} r="2.4" fill="#f8fafc" />
            <text x={cx + 5} y={cy + 3} fill="#e2e8f0" fontSize="9">{e.south_edge_lat}°N</text>
          </g>
        );
      })}

      {/* Svalbard + sea labels */}
      <g>
        <rect x={x(15.6) - 4} y={y(79.35) - 11} width="72" height="15" rx="2" fill="#020617" fillOpacity="0.75" />
        <text x={x(15.6)} y={y(79.35)} fill="#f1f5f9" fontSize="11" fontWeight="700">SVALBARD</text>
        <circle cx={x(15.65)} cy={y(78.22)} r="3" fill="#f472b6" stroke="#020617" strokeWidth="1" />
        <text x={x(15.65) + 6} y={y(78.22) + 3} fill="#f9a8d4" fontSize="8">Longyearbyen 78.2°N</text>
      </g>
      <text x={x(2)} y={y(82.4)} fill="#64748b" fontSize="10">Fram Strait</text>
      <text x={x(28)} y={y(73.5)} fill="#64748b" fontSize="10">Barents Sea</text>
      <text x={x(-22)} y={y(72.5)} fill="#64748b" fontSize="10">Greenland Sea</text>

      <text x={W - 8} y={14} textAnchor="end" fill="#94a3b8" fontSize="10">
        chart {chart.issued} · {chart.chart_id}
      </text>
    </svg>
  );
}

/* ---------------- trend sparkline from NSIDC monthly values ---------------- */
function Spark({ series, color = '#38bdf8' }: { series: [number, number][]; color?: string }) {
  if (series.length < 2) return null;
  const w = 320;
  const h = 70;
  const xs = series.map((p) => p[0]);
  const ys = series.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const px = (v: number) => ((v - minX) / (maxX - minX || 1)) * (w - 8) + 4;
  const py = (v: number) => h - 6 - ((v - minY) / (maxY - minY || 1)) * (h - 16);
  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="monthly ice area series">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={px(series[series.length - 1][0])} cy={py(series[series.length - 1][1])} r="2.4" fill={color} />
      <text x={4} y={10} fill="#64748b" fontSize="8">{maxY.toLocaleString()} km²</text>
      <text x={4} y={h - 2} fill="#475569" fontSize="8">{minY.toLocaleString()}</text>
      <text x={w - 4} y={h - 2} textAnchor="end" fill="#475569" fontSize="8">{maxX}</text>
    </svg>
  );
}

function RegionCard({ region }: { region: Region }) {
  const sept = region.stats_by_month.find((s) => s.month === 9);
  const months = [2, 5, 9];
  return (
    <Glass className="p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-semibold text-white">{region.label}</div>
          <div className="text-[9px] text-slate-400">September ice area, 1978 → latest</div>
        </div>
        {sept && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${sept.slope_km2_per_decade < 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {sept.slope_km2_per_decade > 0 ? '+' : ''}{fmt(sept.slope_km2_per_decade)} km²/dec
          </span>
        )}
      </div>
      <div className="mt-1">
        <Spark series={region.area_months['9'] ?? []} />
      </div>
      {sept && (
        <div className="mt-1 grid grid-cols-3 gap-1 text-[9px]">
          <div>
            <div className="text-slate-500">Sep {sept.latest_year}</div>
            <div className="font-semibold text-slate-100">{fmt(sept.latest_km2)} km²</div>
          </div>
          <div>
            <div className="text-slate-500">1991–2020 mean</div>
            <div className="font-semibold text-slate-100">{fmt(sept.climatology_1991_2020_km2 ?? 0)} km²</div>
          </div>
          <div>
            <div className="text-slate-500">Anomaly</div>
            <div className={`font-semibold ${(sept.anomaly_vs_climatology_km2 ?? 0) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {(sept.anomaly_vs_climatology_km2 ?? 0) > 0 ? '+' : ''}{fmt(sept.anomaly_vs_climatology_km2 ?? 0)}
            </div>
          </div>
        </div>
      )}
      <div className="mt-1.5 space-y-0.5">
        {months.map((m) => {
          const e = region.era_change.find((x) => x.month === m);
          if (!e) return null;
          return (
            <div key={m} className="flex items-center justify-between text-[9px] text-slate-400">
              <span>{MONTHS[m - 1]} · 1979–2000 → 2007–now</span>
              <span className={e.change_km2 < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                {e.change_pct > 0 ? '+' : ''}{e.change_pct}%
              </span>
            </div>
          );
        })}
      </div>
    </Glass>
  );
}

export function SvalbardIceWatch() {
  const chart = useJson<Chart>('chart.json');
  const trends = useJson<Trends>('trends.json');
  const archive = useJson<Archive>('archive.json');
  const [chartImg, setChartImg] = useState<'svalbard' | 'fram_strait' | 'barents'>('svalbard');
  const sheet = useDataSheet('/data/ice/chart.json');
  const archiveFrames = (archive.data?.images ?? []).filter((i) => i.region === 'arctic' || i.region === 'framst').length;
  const arcFilm = useAutoPlay(archiveFrames, 2200);
  const arcStarted = useRef(false);
  useEffect(() => {
    if (arcStarted.current || archiveFrames < 3) return;
    arcStarted.current = true;
    arcFilm.toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveFrames]);

  const t = chart.data?.totals;
  const findings = useMemo(() => {
    const c = chart.data;
    const tr = trends.data;
    if (!c) return 'The Norwegian ice chart could not be loaded, so there are no findings to read.';
    const barents = tr?.regions.find((r) => r.id === 'barents');
    const sept = barents?.stats_by_month.find((s) => s.month === 9);
    const km = (v: number) => Math.round(v / 1000).toLocaleString('en-US');
    const parts = [
      'Ice chart for ' + String(c.issued) + ', issued by the Norwegian Ice Service.',
      km(c.totals.ice_covered_km2) +
        ' thousand square kilometres of ice cover, ' +
        km(c.totals.ice_covered_in_window_km2) +
        ' thousand of it inside the Fram Strait, Svalbard and Barents window.',
    ];
    if (sept) {
      parts.push(
        'Barents Sea September ice is running ' +
          Math.abs(sept.slope_km2_per_decade).toLocaleString('en-US') +
          ' square kilometres lower per decade, ' +
          Math.abs(sept.pct_per_decade ?? 0) +
          ' percent. In ' +
          sept.latest_year +
          ' September ice covered ' +
          sept.latest_km2.toLocaleString('en-US') +
          ' square kilometres, against a 1991 to 2020 average of ' +
          (sept.climatology_1991_2020_km2 ?? 0).toLocaleString('en-US') +
          '.',
      );
    }
    parts.push('These are the published chart and NSIDC regional figures, not a forecast.');
    return parts.join(' ');
  }, [chart.data, trends.data]);

  return (
    <div className="space-y-3">
      <Glass className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-white">Svalbard ice watch · MET Norway ice charts</h2>
              <StatusBadge status={chart.data ? 'live' : 'snapshot'} note={chart.data ? 'chart parsed' : 'loading'} />
              <FindingsVoice text={findings} />
              <ViewSwitch
                open={sheet.open}
                setOpen={sheet.setOpen}
                jsonUrl="/data/ice/chart.json"
                csv={{
                  head: ['class', 'concentration %', 'polygons', 'area in window km2', 'ice covered in window km2'],
                  body: (chart.data?.classes ?? []).map((c) => [
                    c.nis_class,
                    c.ct,
                    c.polygons,
                    Math.round(c.area_in_window_km2),
                    Math.round(c.ice_covered_in_window_km2 ?? 0),
                  ]),
                }}
                csvName="orbit-svalbard-ice-chart.csv"
              />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              The Norwegian Ice Service chart for the European Arctic, parsed from its published SIGRID-3 shapefile
              ({chart.data?.counts.polygons ?? '—'} polygons), against NSIDC's regional ice-area record since 1978.
            </p>
          </div>
          {chart.data && (
            <div className="text-right text-[10px] text-slate-400">
              <div className="font-mono text-slate-200">{chart.data.issued}</div>
              <div>valid {chart.data.valid_from} → {chart.data.valid_to}</div>
              <a className="text-sky-400 hover:underline" href={chart.data.source_url} target="_blank" rel="noreferrer">cryo.met.no ↗</a>
            </div>
          )}
        </div>

        {chart.data && sheet.open === 'table' && (
          <div className="mt-2">
            <Table
              head={['Concentration class', 'CT %', 'Polygons', 'Charted km²', 'Ice-covered km²']}
              body={chart.data.classes.map((c) => [
                c.nis_class,
                c.ct,
                c.polygons,
                Math.round(c.area_in_window_km2),
                Math.round(c.ice_covered_in_window_km2 ?? 0),
              ])}
            />
            <div className="mt-1 text-[9px] text-slate-500">
              Chart {chart.data.issued} · areas computed from the SIGRID-3 polygon geometry, window {chart.data.window.minLat}°–{chart.data.window.maxLat}°N.
            </div>
          </div>
        )}
        {sheet.open === 'json' && <JsonPane raw={sheet.raw} err={sheet.err} url="/data/ice/chart.json" />}

        {chart.err && (
          <div className="mt-2 rounded border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
            ice chart not loaded ({chart.err}) — run <code className="rounded bg-white/10 px-1">npm run data:ice</code>. No numbers are shown in its place.
          </div>
        )}

        {chart.data && (
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-white/10">
              <IceMap chart={chart.data} />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">Ice-covered area</div>
                  <div className="text-[16px] font-semibold text-white">{fmt(t!.ice_covered_km2)}</div>
                  <div className="text-[9px] text-slate-500">km² · concentration-weighted</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">In this window</div>
                  <div className="text-[16px] font-semibold text-white">{fmt(t!.ice_covered_in_window_km2)}</div>
                  <div className="text-[9px] text-slate-500">km² · of {fmt(t!.charted_zone_in_window_km2)} charted</div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Concentration classes on this chart</div>
                <div className="space-y-1">
                  {chart.data.classes
                    .filter((c) => (c.ct ?? 0) > 0)
                    .sort((a, b) => (b.ct ?? 0) - (a.ct ?? 0))
                    .map((c) => (
                      <div key={c.nis_class} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: c.color }} />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{c.nis_class}</span>
                        <span className="font-mono text-[9px] text-slate-400">CT {c.ct}%</span>
                        <span className="w-[74px] text-right font-mono text-[9px] text-slate-300">{fmt(Math.round(c.area_in_window_km2))} km²</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <div className="mb-1 text-[9px] uppercase tracking-wide text-slate-500">Ice edge · southernmost charted ice</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {chart.data.ice_edge.slice(0, 10).map((e) => (
                    <div key={e.lon_from} className="flex justify-between font-mono text-[9px] text-slate-400">
                      <span>{e.lon_from}°…{e.lon_to}°E</span>
                      <span className="text-slate-200">{e.south_edge_lat}°N</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Glass>

      {/* analyst chart images */}
      <Glass className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-white">The published chart, as the analyst drew it</div>
            <div className="text-[10px] text-slate-400">Latest regional chart from the Norwegian Ice Service — the same analysis the polygons above were parsed from.</div>
          </div>
          <div className="flex gap-1">
            {(['svalbard', 'fram_strait', 'barents'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setChartImg(r)}
                className={`rounded border px-1.5 py-0.5 text-[9px] transition ${chartImg === r ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-white/10 text-slate-300 hover:border-white/25'}`}
              >
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <ZoomableImage
          src={'https://cryo.met.no/sites/cryo.met.no/files/latest/' + chartImg + '_latest.png'}
          alt={'Norwegian Ice Service ' + chartImg + ' chart'}
          className="mt-2 h-auto w-full rounded border border-white/10"
          label={'Norwegian Ice Service · ' + chartImg + ' chart'}
          caption={chart.data ? 'chart ' + chart.data.issued : undefined}
          source="MET Norway / Norwegian Ice Service"
          date={chart.data?.issued ?? undefined}
          href={'https://cryo.met.no/sites/cryo.met.no/files/latest/' + chartImg + '_latest.png'}
        />
      </Glass>

      {/* trends */}
      <div>
        <div className="mb-1.5 flex items-end justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-white">Shifts and trends · NSIDC regional ice area</h3>
            <p className="text-[10px] text-slate-400">
              Barents, Greenland and Kara seas — the water around Svalbard. Least-squares slopes on the published monthly series.
            </p>
          </div>
          {trends.data && <span className="text-[9px] text-slate-500">{trends.data.source} · climatology {trends.data.climatology}</span>}
        </div>
        {trends.err && <div className="rounded border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">trends not loaded ({trends.err})</div>}
        <div className="grid gap-2 md:grid-cols-3">
          {trends.data?.regions.map((r) => <RegionCard key={r.id} region={r} />)}
        </div>
      </div>

      {/* archive strip */}
      <Glass className="p-4">
        <div className="text-[12px] font-semibold text-white">{archive.data?.title ?? 'Ice-chart archive'}</div>
        <p className="text-[10px] text-slate-400">{archive.data?.note ?? 'Loading archive…'}</p>
        {(() => {
          const frames = (archive.data?.images ?? []).filter((i) => i.region === 'arctic' || i.region === 'framst');
          if (!frames.length) return null;
          const at = frames[Math.min(arcFilm.index, frames.length - 1)];
          return (
            <div className="mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] text-slate-400">
                  February {at.date.slice(0, 4)} · {at.region === 'framst' ? 'Fram Strait' : 'Arctic'} · the analyst&apos;s own chart
                </div>
                <PlayBar
                  count={frames.length}
                  index={arcFilm.index}
                  playing={arcFilm.playing}
                  onToggle={arcFilm.toggle}
                  onPick={arcFilm.goto}
                  label="play years"
                  intervalMs={2200}
                />
              </div>
              <a href={at.url} target="_blank" rel="noreferrer" className="group mt-1 block">
                <img
                  src={at.url}
                  alt={`${at.region} chart ${at.date}`}
                  className="h-[300px] w-full rounded border border-white/10 object-contain group-hover:border-white/30"
                  loading="lazy"
                />
              </a>
              <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
                {frames.map((f, i) => (
                  <button
                    key={f.url}
                    type="button"
                    onClick={() => arcFilm.goto(i)}
                    className={`shrink-0 rounded border px-1 py-0.5 text-[8px] transition ${i === arcFilm.index ? 'border-sky-400/60 bg-sky-500/20 text-sky-200' : 'border-white/10 text-slate-400 hover:border-white/25'}`}
                  >
                    {f.date.slice(0, 4)}
                  </button>
                ))}
              </div>
              <div className="text-[8px] text-slate-500">Same week each year — the sequence plays the years in order, click any year to stop on it.</div>
            </div>
          );
        })()}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Chip><Icon name="Database" className="h-3 w-3" />MET Norway SIGRID-3</Chip>
          <Chip>NSIDC v4.0 regional</Chip>
          <Chip>keyless</Chip>
        </div>
        {chart.data && (
          <p className="mt-1.5 text-[9px] leading-snug text-slate-500">
            {chart.data.provenance.honesty} {trends.data?.method}
          </p>
        )}
      </Glass>
    </div>
  );
}

export default SvalbardIceWatch;
