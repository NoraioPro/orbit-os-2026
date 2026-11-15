import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../data/live';
import { useStore } from '../state/store';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { OrbitGlobe } from '../components/OrbitGlobe';
import { Provenance } from '../components/Provenance';
import { NarrationButton } from '../components/Narration';

/** one series as produced by scripts/build-domains.mjs */
interface DomainSeries {
  id: string;
  label: string;
  unit: string;
  months: string[];
  values: (number | null)[];
  latest: number | null;
  mean: number | null;
  note: string;
}
interface DomainImage {
  id: string;
  title: string;
  label: string;
  status: string;
  note?: string;
  gibs?: string;
  theme?: string;
  maxLevel?: number | null;
}
interface DomainData {
  domain: string;
  title: string;
  subtitle: string;
  aoi: { id: string; name: string; lat: number; lon: number };
  generated_at: string;
  provenance: { provider: string; url: string; access: string; honesty: string; note: string };
  imagery: DomainImage[];
  series: DomainSeries[];
  weather: { id: string; label: string; unit: string; value: number | null }[];
  coverage: { start: string | null; end: string | null; window: string };
}

/** GIBS WMS GetMap for an AOI window — real NASA imagery, no pixel values are read back. */
function gibsUrl(layer: string, bbox: [number, number, number, number], size = 420, date = '2026-09-01') {
  const [w, s, e, n] = bbox;
  const q = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1', LAYERS: layer, STYLES: '',
    FORMAT: 'image/png', TRANSPARENT: 'false', HEIGHT: String(size), WIDTH: String(size),
    SRS: 'EPSG:4326', BBOX: `${w},${s},${e},${n}`, TIME: date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q.toString()}`;
}

const BBOX: Record<string, [number, number, number, number]> = {
  agri: [0.5, 11.0, 6.5, 16.5],
  ocean: [-60, 32, -40, 44],
};

/** Dual-line mini chart: two series on one axis-free card, months on x. */
function DualSeries({ a, b, colorA, colorB, height = 128 }: { a: DomainSeries; b: DomainSeries; colorA: string; colorB: string; height?: number }) {
  const W = 320;
  const H = height;
  const pts = (s: DomainSeries) => {
    const vals = s.values.filter((v): v is number => v !== null);
    if (!vals.length) return { path: '', dots: [] as [number, number][], min: 0, max: 1 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const stepPct = 100 / Math.max(1, s.values.length - 1);
    const dots: [number, number][] = [];
    s.values.forEach((v, i) => {
      if (v === null) return;
      dots.push([(i * stepPct), H - 10 - ((v - min) / span) * (H - 26)]);
    });
    return { path: dots.map(([x, y], i) => `${i ? 'L' : 'M'}${((x / 100) * (W - 8) + 4).toFixed(1)},${y.toFixed(1)}`).join(' '), dots, min, max };
  };
  const A = pts(a);
  const B = pts(b);
  return (
    <div className="relative">
      <div className="flex items-start justify-between text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-3 rounded-full ${colorA === '#34d399' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />{a.label}</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-yellow-400" />{b.label}</span>
      </div>
      {A.dots.length > 0 && (
        <div className="pointer-events-none absolute left-0 top-4 text-[9px] text-slate-500">
          <div>{A.max.toFixed(2)}</div>
          <div className="mt-[64px]">{A.min.toFixed(2)}</div>
          <div className="mt-[18px] text-slate-600">{a.unit}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${a.label} and ${b.label} monthly series, ${a.unit}`}>
        <line x1="0" y1={H - 10} x2={W} y2={H - 10} stroke="rgba(148,163,184,.25)" strokeWidth="1" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="0" y1={10 + i * ((H - 20) / 3)} x2={W} y2={10 + i * ((H - 20) / 3)} stroke="rgba(148,163,184,.08)" strokeWidth="1" />
        ))}
        {B.path && <path d={B.path} fill="none" stroke={colorB} strokeWidth="1.6" strokeDasharray="4 3" />}
        {A.path && <path d={A.path} fill="none" stroke={colorA} strokeWidth="2" />}
        {A.dots.map(([x, y], i) => (
          <circle key={`a${i}`} cx={(x / 100) * (W - 8) + 4} cy={y} r="2.4" fill={colorA} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-slate-500">{a.months.map((m, i) => <span key={`${m}${i}`}>{m}</span>)}</div>
    </div>
  );
}

function ImageryCard({ img, bbox, accent }: { img: DomainImage; bbox: [number, number, number, number]; accent: string }) {
  const [failed, setFailed] = useState(false);
  if (!img.gibs) {
    return (
      <div className="grid h-full min-h-[150px] place-items-center rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-3 text-center">
        <div>
          <Icon name="TriangleAlert" className="mx-auto h-5 w-5 text-amber-300" />
          <p className="mt-1.5 text-[11px] font-semibold text-amber-200">{img.title}</p>
          <p className="mt-0.5 text-[10px] text-amber-300/80">not connected — {img.label}</p>
          {img.note && <p className="mt-1 text-[10px] leading-snug text-slate-400">{img.note}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
      {failed ? (
        <div className="grid h-[190px] place-items-center p-3 text-center text-[10px] text-slate-400">
          GIBS imagery unavailable for this window.
          <br />
          Layer: {img.gibs}
        </div>
      ) : (
        <img
          src={gibsUrl(img.gibs, bbox, 460)}
          alt={`${img.label} — NASA GIBS`}
          className="h-[190px] w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-2.5 pb-2 pt-8">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-white">{img.title}</span>
          <span className={`shrink-0 text-[10px] ${accent}`}>GIBS</span>
        </div>
        <div className="text-[10px] text-slate-300">{img.label}</div>
        <div className="truncate text-[9px] text-slate-500" title={img.gibs}>layer {img.gibs} · TIME 2026-09-01</div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, unit, status, note, accent }: { label: string; value: string; unit?: string; status?: 'live' | 'sample' | 'not connected'; note?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{label}</span>
        {status && <span className={`shrink-0 text-[9px] font-semibold uppercase ${status === 'live' ? 'text-emerald-300' : status === 'sample' ? 'text-amber-300' : 'text-slate-500'}`}>{status}</span>}
      </div>
      <div className={`mt-1 text-[20px] font-semibold leading-none ${accent}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[10px] leading-snug text-slate-400">{note}</div>}
    </div>
  );
}

function DomainPanel({ d, side }: { d: DomainData; side: 'left' | 'right' }) {
  const agri = d.domain === 'agri';
  const accent = agri ? 'text-emerald-300' : 'text-cyan-300';
  const ring = agri ? 'border-emerald-400/25' : 'border-cyan-400/25';
  const glow = agri ? 'from-emerald-500/10' : 'from-cyan-500/10';
  const bbox = BBOX[d.domain] ?? BBOX.agri;
  const [a, b] = d.series;
  const latest = b?.latest;

  return (
    <Glass className={`flex min-h-0 flex-col gap-2 border ${ring} bg-gradient-to-b ${glow} to-transparent p-3`}>
      <div className="flex items-start gap-2">
        <div className={`rounded-lg border border-white/10 bg-white/5 p-1.5 ${accent}`}>
          <Icon name={agri ? 'Sprout' : 'Waves'} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-white">{d.title}</h3>
            <StatusBadge status={d.provenance.honesty === 'live' ? 'live' : 'snapshot'} note={d.provenance.honesty} />
          </div>
          <p className="truncate text-[10px] text-slate-400">{d.subtitle} · {d.aoi.name}</p>
        </div>
        {side === 'right' && <Icon name="ChevronRight" className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
      </div>

      <ImageryCard img={d.imagery[0]} bbox={bbox} accent={accent} />

      <div className="grid grid-cols-2 gap-2">
        {agri ? (
          <>
            <MetricTile
              label="Soil moisture"
              value={a?.latest !== null && a?.latest !== undefined ? Number(a.latest).toFixed(2) : '—'}
              unit="fraction"
              status="live"
              note={`GWETROOT · ${d.aoi.name} point`}
              accent={accent}
            />
            <MetricTile
              label="Precipitation"
              value={b?.latest !== null && b?.latest !== undefined ? Number(b.latest).toFixed(2) : '—'}
              unit="mm/day"
              status="live"
              note="POWER monthly mean, latest month"
              accent={accent}
            />
          </>
        ) : (
          <>
            <MetricTile
              label="Marine air temp"
              value={a?.latest !== null && a?.latest !== undefined ? Number(a.latest).toFixed(1) : '—'}
              unit="°C"
              status="live"
              note="T2M over ocean — not SST"
              accent={accent}
            />
            <MetricTile
              label="Chlorophyll"
              value="—"
              status="not connected"
              note="PACE/MODIS ocean colour is a planned connector"
              accent="text-slate-300"
            />
          </>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Time series · {d.coverage.window}</span>
          <span className="text-[9px] text-slate-500">POWER monthly</span>
        </div>
        <DualSeries a={a} b={b} colorA={agri ? '#34d399' : '#22d3ee'} colorB="#eab308" />
        <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-3 rounded-full ${agri ? 'bg-emerald-400' : 'bg-cyan-400'}`} />{a?.label}</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-yellow-400" />{b?.label}</span>
          <span className="ml-auto text-slate-500">latest {latest === null || latest === undefined ? '—' : latest.toFixed(2)} {b?.unit}</span>
        </div>
      </div>
    </Glass>
  );
}

/** Agri × Ocean unified geospatial view — the "one Earth, two domains, one Earthdata path" screen. */
export function UnifiedGeospatial() {
  const { db } = useStore();
  const [agri, setAgri] = useState<DomainData | null>(null);
  const [ocean, setOcean] = useState<DomainData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([fetchJson('/data/domains/agri.json', 9000), fetchJson('/data/domains/ocean.json', 9000)])
      .then(([a, o]: [DomainData, DomainData]) => {
        if (!live) return;
        setAgri(a);
        setOcean(o);
      })
      .catch((e: Error) => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const weatherRows = useMemo(() => {
    if (!agri || !ocean) return [];
    return [
      { aoi: agri.aoi.name, kind: 'Land AOI · POWER AG', accent: 'text-emerald-300', values: agri.weather },
      { aoi: ocean.aoi.name, kind: 'Ocean AOI · POWER RE', accent: 'text-cyan-300', values: ocean.weather },
    ];
  }, [agri, ocean]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold leading-tight text-white">
            Agri Intelligence <span className="text-slate-500">&amp;</span> Ocean Intelligence
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-300">Unified geospatial analytics with NASA Earthdata</p>
        </div>
        <div className="flex items-center gap-2">
          <NarrationButton src="/assets/audio/earth-intelligence.mp3" label="Narration" />
          <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-tight text-white">NASA</span>
              <span className="text-[11px] text-sky-200">Earthdata</span>
            </div>
            <div className="text-[9px] leading-tight text-slate-400">Multi-source satellite observations for land, ocean and atmosphere</div>
          </div>
        </div>
      </div>

      {loading && <Glass className="p-6 text-center text-[12px] text-slate-400">Loading domain layer…</Glass>}
      {err && (
        <Glass className="border-amber-400/30 p-4 text-[12px] text-amber-200">
          Domain layer failed to load ({err}). Run <code className="rounded bg-white/10 px-1">node scripts/build-domains.mjs</code> to rebuild it — nothing is shown rather than a guess.
        </Glass>
      )}

      {agri && ocean && (
        <>
          <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1.18fr)_minmax(0,1fr)]">
            <DomainPanel d={agri} side="left" />

            <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-b from-slate-900/40 to-slate-950/60">
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">One Earth · two domains</span>
                <Chip><Icon name="Earth" className="h-3 w-3" /> 2 AOIs</Chip>
              </div>
              <div className="min-h-0 flex-1">
                <OrbitGlobe db={db} height={360} autoRotate layerSelector={false} showFirms={false} focus={{ lat: agri.aoi.lat, lng: agri.aoi.lon }} initial={{ lat: 20, lng: 0, altitude: 2.1 }} />
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3 text-[10px]">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2">
                  <div className="text-emerald-300">{agri.aoi.name}</div>
                  <div className="text-slate-400">agri AOI · {agri.aoi.lat}°N {agri.aoi.lon}°E</div>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
                  <div className="text-cyan-300">{ocean.aoi.name}</div>
                  <div className="text-slate-400">ocean AOI · {ocean.aoi.lat}°N {Math.abs(ocean.aoi.lon)}°W</div>
                </div>
              </div>
            </div>

            <DomainPanel d={ocean} side="right" />
          </div>

          <Glass className="p-3">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-white">Weather context</h3>
                <p className="text-[10px] text-slate-400">Latest complete month per AOI · NASA POWER monthly point API</p>
              </div>
              <span className="text-[10px] text-slate-400">a parameter POWER does not return is shown as “not returned”, never as zero</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {weatherRows.map((row) => (
                <div key={row.aoi} className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${row.accent}`}>{row.aoi}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">{row.kind}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {row.values.map((w) => (
                      <div key={w.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-1.5 py-1">
                        <div className="truncate text-[10px] uppercase tracking-[0.06em] text-slate-400">{w.label}</div>
                        <div className="text-[13px] font-semibold text-white">
                          {w.value === null ? (
                            <span className="text-slate-500" title="POWER returned a fill value for this parameter/AOI">not returned</span>
                          ) : (
                            <>
                              {w.value.toFixed(1)}
                              <span className="ml-0.5 text-[10px] font-normal text-slate-400">{w.unit}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Glass>

          <Provenance
            honesty="live"
            coverage={{ start: agri.coverage.start ?? '', end: agri.coverage.end ?? '', label: `${agri.coverage.window} (POWER monthly, latest complete month per AOI)` }}
            citation="ORBIT OS · unified domain layer built by scripts/build-domains.mjs from keyless NASA POWER + NASA GIBS"
            sources={[
              { name: 'NASA POWER', url: 'https://power.larc.nasa.gov/', note: 'GWETROOT · T2M · PRECTOTCORR · WS2M, monthly point API' },
              { name: 'NASA GIBS', url: 'https://gibs.earthdata.nasa.gov/', note: 'MODIS Terra NDVI 8-day · GHRSST MUR L4 SST (imagery only)' },
              { name: 'NASA Earthdata', url: 'https://www.earthdata.nasa.gov/', note: 'imagery and parameter access path' },
            ]}
          />
          <p className="text-[11px] leading-relaxed text-slate-400">
            Honesty: MODIS/VIIRS/GHRSST tiles are rendered by NASA GIBS and never read back as pixel values. Soil moisture is POWER GWETROOT
            (root-zone wetness, 0–1), not a SMAP retrieval. Marine temperature is air temperature over the ocean, not SST. Chlorophyll has no
            connector in this build, so the panel shows “not connected” instead of a number.
          </p>
        </>
      )}
    </div>
  );
}
