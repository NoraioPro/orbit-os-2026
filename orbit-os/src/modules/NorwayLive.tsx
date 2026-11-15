import { useEffect, useMemo, useState } from 'react';
import { ZoomableImage } from '../components/ImageViewer';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { JsonPane, Table, ViewSwitch, useDataSheet } from '../components/DataSheet';

/**
 * Norwegian official data panel — MET Norway (api.met.no) and NVE.
 *
 * Every figure carries the API that produced it and the timestamp of the fetch,
 * printed directly under the numbers. A missing value says so; an empty NVE
 * warning list is reported as "no warning issued", which is a real answer, not a
 * failure. Nothing here is modelled by ORBIT: the numbers are copied from the
 * Norwegian public services.
 */

interface Hour {
  at: string;
  airTempC: number | null;
  windMs: number | null;
  precipMm: number | null;
  symbol?: string | null;
}

interface Aoi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  use_case: string;
  fetched_at: string;
  forecast?: {
    updated?: string | null;
    source: string;
    url: string;
    licence?: string;
    unavailable?: string;
    now?: {
      airTempC: number | null;
      windMs: number | null;
      windDirDeg: number | null;
      humidityPct: number | null;
      pressureHpa?: number | null;
      cloudPct: number | null;
      symbol: string | null;
      precipNextHourMm: number | null;
    };
    hours?: Hour[];
    hours_available?: number;
  };
  ocean?: {
    source: string;
    url: string;
    licence?: string;
    unavailable?: string;
    seaWaterTempC?: number | null;
    waveHeightM?: number | null;
    waveDirectionDeg?: number | null;
    currentSpeedMs?: number | null;
    currentDirDeg?: number | null;
  };
  sun?: {
    source: string;
    url: string;
    sunrise?: string | null;
    sunset?: string | null;
    solarNoon?: string | null;
    polar?: string | null;
    unavailable?: string;
  };
  air?: {
    source: string;
    url: string;
    at?: string | null;
    pm25?: number | null;
    pm10?: number | null;
    no2?: number | null;
    ozone?: number | null;
    aqi?: number | null;
    licence?: string;
    unavailable?: string;
  };
  metar?: { source: string; url: string; raw?: string | null; unavailable?: string };
  flood_warnings?: Warnings;
  landslide_warnings?: Warnings;
}

interface Warnings {
  source: string;
  url: string;
  count?: number;
  items?: { region: string | null; level: number | null; type: string | null; when: string | null; text: string | null }[];
  unavailable?: string;
}

interface Payload {
  generated_at: string;
  provenance: { providers: string[]; licences: string[]; honesty: string };
  aois: Aoi[];
}

let cache: Payload | null = null;

const n1 = (v: number | null | undefined) => (typeof v === 'number' ? (Math.round(v * 10) / 10).toFixed(1) : '—');
const tLoc = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Oslo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** The honesty strip the user asked for: printed under the numbers, not hidden in a tooltip. */
function SourceLine({ text, url, at }: { text: string; url?: string; at?: string | null }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
      <span>{text}</span>
      {at && <span className="text-slate-600">· fetched {tLoc(at)}</span>}
      {url && (
        <a className="text-sky-400/80 hover:underline" href={url} target="_blank" rel="noreferrer">
          source ↗
        </a>
      )}
    </div>
  );
}

function Metric({ label, value, unit, tone = 'text-slate-100' }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className={`text-[14px] font-semibold leading-tight ${tone}`}>
        {value}
        {unit && <span className="ml-0.5 text-[9px] font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function WarningList({ w, kind }: { w?: Warnings; kind: 'flood' | 'landslide' }) {
  if (!w) return null;
  const empty = !w.unavailable && (w.count ?? 0) === 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-slate-500">NVE {kind} warning</span>
        <span className={`text-[10px] font-semibold ${empty ? 'text-emerald-300' : w.unavailable ? 'text-amber-300' : 'text-rose-300'}`}>
          {w.unavailable ? 'unavailable' : empty ? 'none issued' : `${w.count} active`}
        </span>
      </div>
      {!empty && !w.unavailable && w.items?.slice(0, 2).map((i, k) => (
        <div key={k} className="mt-0.5 text-[9px] text-slate-400">
          {i.region ?? 'region'} · level {i.level ?? '—'} · {i.type ?? ''}
        </div>
      ))}
      <SourceLine text={w.source} url={w.url} />
    </div>
  );
}

function Spark({ hours }: { hours: Hour[] }) {
  const pts = hours.map((h) => h.airTempC).filter((v): v is number => v !== null);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * 280;
      const y = 34 - ((v - lo) / (hi - lo || 1)) * 30;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 280 38" className="mt-1 h-[38px] w-full" role="img" aria-label="next 24 hours air temperature">
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="1.4" />
      <text x="0" y="8" fill="#475569" fontSize="7">{n1(hi)}°</text>
      <text x="0" y="36" fill="#475569" fontSize="7">{n1(lo)}°</text>
    </svg>
  );
}

export function NorwayLive({ aoiId, title, compact = false }: { aoiId: string; title?: string; compact?: boolean }) {
  const [data, setData] = useState<Payload | null>(cache);
  const [err, setErr] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const sheet = useDataSheet('/data/norway/index.json');

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch('/data/norway/index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: Payload) => {
        cache = j;
        if (alive) setData(j);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const aoi = useMemo(() => data?.aois.find((a) => a.id === aoiId) ?? null, [data, aoiId]);

  if (err) {
    return (
      <Glass className="p-3">
        <div className="text-[11px] text-amber-200">
          Norwegian data not loaded ({err}) — run <code className="rounded bg-white/10 px-1">npm run data:norway</code>. No figures are shown in its place.
        </div>
      </Glass>
    );
  }
  if (!data || !aoi) {
    return (
      <Glass className="p-3">
        <div className="text-[11px] text-slate-400">Loading MET Norway and NVE data…</div>
      </Glass>
    );
  }

  const now = aoi.forecast?.now;
  const sun = aoi.sun;
  const sea = aoi.ocean;
  const air = aoi.air;

  return (
    <Glass className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="CloudSun" className="h-4 w-4 text-sky-300" />
            <span className="text-[12px] font-semibold text-white">{title ?? `Norwegian live data · ${aoi.name}`}</span>
            <StatusBadge status="live" note="met.no · nve" />
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {aoi.name} · {aoi.lat.toFixed(2)}°N {aoi.lon.toFixed(2)}°E — {aoi.use_case}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
        <ViewSwitch
          open={sheet.open}
          setOpen={sheet.setOpen}
          jsonUrl="/data/norway/index.json"
          csv={{
            head: ['AOI', 'hour (Oslo)', 'air temp C', 'wind m/s', 'precip mm'],
            body: (aoi.forecast?.hours ?? []).map((h) => [aoi.name, h.at, h.airTempC, h.windMs, h.precipMm]),
          }}
          csvName={`orbit-${aoi.id}-forecast.csv`}
        />
        <button
          type="button"
          onClick={() => setShowRadar((v) => !v)}
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] transition ${showRadar ? 'border-sky-400/50 bg-sky-500/15 text-sky-200' : 'border-white/10 text-slate-300 hover:border-white/25'}`}
        >
          {showRadar ? 'hide radar' : 'precipitation radar'}
        </button>
        </div>
      </div>

      {sheet.open === 'table' && (
        <Table
          head={['Measure', 'Value', 'Unit', 'Source']}
          body={[
            ['Air temperature', now?.airTempC ?? '—', '°C', 'MET Norway Locationforecast 2.0'],
            ['Wind speed', now?.windMs ?? '—', 'm/s', 'MET Norway Locationforecast 2.0'],
            ['Precipitation next hour', now?.precipNextHourMm ?? '—', 'mm', 'MET Norway Locationforecast 2.0'],
            ['Relative humidity', now?.humidityPct ?? '—', '%', 'MET Norway Locationforecast 2.0'],
            ['Sea water temperature', sea?.seaWaterTempC ?? '—', '°C', 'MET Norway Oceanforecast 2.0'],
            ['Wave height', sea?.waveHeightM ?? '—', 'm', 'MET Norway Oceanforecast 2.0'],
            ['Current speed', sea?.currentSpeedMs ?? '—', 'm/s', 'MET Norway Oceanforecast 2.0'],
            ['Air quality index', air?.aqi ?? '—', '1–5', 'MET Norway Air Quality Forecast 0.1'],
            ['PM2.5', air?.pm25 ?? '—', 'µg/m³', 'MET Norway Air Quality Forecast 0.1'],
            ['NO₂', air?.no2 ?? '—', 'µg/m³', 'MET Norway Air Quality Forecast 0.1'],
            ['Flood warnings', aoi.flood_warnings?.count ?? '—', 'count', 'NVE'],
            ['Landslide warnings', aoi.landslide_warnings?.count ?? '—', 'count', 'NVE'],
          ]}
        />
      )}
      {sheet.open === 'json' && <JsonPane raw={sheet.raw} err={sheet.err} url="/data/norway/index.json" />}

      {now ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Metric label="Air temp" value={n1(now.airTempC)} unit="°C" tone="text-sky-200" />
            <Metric label="Wind" value={n1(now.windMs)} unit="m/s" />
            <Metric label="Precip 1 h" value={n1(now.precipNextHourMm)} unit="mm" />
            <Metric label="Humidity" value={now.humidityPct != null ? String(Math.round(now.humidityPct)) : '—'} unit="%" />
          </div>
          <SourceLine text={aoi.forecast!.source + (now.symbol ? ` · ${now.symbol.replace(/_/g, ' ')}` : '')} url={aoi.forecast!.url} at={aoi.forecast!.updated ?? aoi.fetched_at} />
          {!compact && aoi.forecast?.hours && aoi.forecast.hours.length > 1 && (
            <div className="mt-1.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Next {Math.min(24, aoi.forecast.hours.length)} hours · air temperature</div>
              <Spark hours={aoi.forecast.hours} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-2 text-[11px] text-amber-200">Forecast unavailable: {aoi.forecast?.unavailable ?? 'no data'}</div>
      )}

      {/* the Svalbard case: polar night is a real answer, not a missing value */}
      {sun && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
          {sun.polar ? (
            <span className="rounded border border-indigo-400/30 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-200">
              {sun.polar} — no sunrise or sunset on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          ) : (
            <span className="text-slate-300">
              Sunrise <b className="text-slate-100">{sun.sunrise?.slice(11, 16) ?? '—'}</b> · sunset{' '}
              <b className="text-slate-100">{sun.sunset?.slice(11, 16) ?? '—'}</b> (Oslo time)
            </span>
          )}
          <SourceLine text={sun.source} url={sun.url} />
        </div>
      )}

      {(sea || air) && (
        <div className={`mt-1.5 grid gap-1.5 ${sea && air ? 'sm:grid-cols-2' : ''}`}>
          {sea && (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/[0.05] px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wide text-cyan-200/80">Sea state · Oceanforecast 2.0</div>
              {sea.unavailable ? (
                <div className="text-[10px] text-amber-300">unavailable: {sea.unavailable}</div>
              ) : (
                <>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <Metric label="Wave" value={n1(sea.waveHeightM)} unit="m" tone="text-cyan-200" />
                    <Metric label="Water" value={n1(sea.seaWaterTempC)} unit="°C" />
                    <Metric label="Current" value={n1(sea.currentSpeedMs)} unit="m/s" />
                  </div>
                  <SourceLine text={sea.source} url={sea.url} at={data.generated_at} />
                </>
              )}
            </div>
          )}
          {air && (
            <div className="rounded-lg border border-violet-400/20 bg-violet-500/[0.05] px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wide text-violet-200/80">Air quality · Air Quality Forecast 0.1</div>
              {air.unavailable ? (
                <div className="text-[10px] text-amber-300">unavailable: {air.unavailable}</div>
              ) : (
                <>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <Metric label="AQI" value={n1(air.aqi)} unit="1–5" tone="text-violet-200" />
                    <Metric label="PM2.5" value={n1(air.pm25)} unit="µg/m³" />
                    <Metric label="NO₂" value={n1(air.no2)} unit="µg/m³" />
                  </div>
                  <SourceLine text={air.source} url={air.url} at={air.at ?? data.generated_at} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(aoi.flood_warnings || aoi.landslide_warnings) && (
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <WarningList w={aoi.flood_warnings} kind="flood" />
          <WarningList w={aoi.landslide_warnings} kind="landslide" />
        </div>
      )}

      {aoi.metar?.raw && (
        <div className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Latest aviation observation</div>
          <div className="mt-0.5 font-mono text-[9px] leading-snug text-slate-300">{aoi.metar.raw}</div>
          <SourceLine text={aoi.metar.source} url={aoi.metar.url} at={data.generated_at} />
        </div>
      )}

      {showRadar && (
        <div className="mt-1.5">
          <ZoomableImage
            src="https://api.met.no/weatherapi/radar/2.0/?type=reflectivity&area=norway&content=image"
            alt="MET Norway precipitation radar over Norway"
            className="w-full rounded border border-white/10"
            label="MET Norway precipitation radar · Norway"
            source="MET Norway Radar 2.0"
            href="https://api.met.no/weatherapi/radar/2.0/?type=reflectivity&area=norway&content=image"
          />
          <SourceLine
            text="MET Norway · Radar 2.0 reflectivity composite, Norway"
            url="https://api.met.no/weatherapi/radar/2.0/?type=reflectivity&area=norway&content=image"
          />
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
        <Chip>MET Norway · {data.provenance.licences[0]}</Chip>
        <Chip>NVE · NLOD</Chip>
        <Chip>keyless</Chip>
        <Chip>fetched {tLoc(data.generated_at)}</Chip>
      </div>
    </Glass>
  );
}

export default NorwayLive;
