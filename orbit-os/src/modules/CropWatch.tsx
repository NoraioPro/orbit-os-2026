import { useEffect, useMemo, useState } from 'react';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';

/* ------------------------------------------------------------------ *
 * CropWatch — challenge #6 "Field Shift Rotation Planner"
 * Crop monitor + harvest-readiness alert system.
 *
 * Data: Open-Meteo historical archive (keyless, CORS-open), fetched live
 * per region. The registry coordinates are approximate site picks, the
 * plant months are typical for the region, and the GDD maturity values
 * are approximate reference figures — this is a heuristic, NOT an
 * official agronomic advisory (see caveats below).
 * ------------------------------------------------------------------ */

/** Registry entry for one crop region. */
export interface CropRegion {
  country: string;
  region: string;
  crop: string;
  lat: number;
  lon: number;
  /** 1–12, approximate typical planting month for the region. */
  plantMonth: number;
  /** Growing-degree-day base temperature in °C. */
  gddBase: number;
  /** Approximate accumulated GDD to harvest readiness. */
  gddMaturity: number;
}

/**
 * Approximate reference GDD maturity values (cited as approximate — the
 * values are indicative, not agronomic guidance):
 *   wheat base 0°C ≈ 1500 GDD · barley base 0°C ≈ 1300 GDD
 *   maize base 10°C ≈ 1600 GDD · rice base 10°C ≈ 1800 GDD
 *   soybean base 10°C ≈ 1500 GDD · cotton base 12°C ≈ 1800 GDD
 *   sorghum/millet base 10°C ≈ 1700 GDD
 */
export const CROP_REGIONS: CropRegion[] = [
  // Wheat (base 0 °C, ≈ 1500 GDD)
  { country: 'USA', region: 'North Dakota', crop: 'Wheat (spring)', lat: 46.8, lon: -100.8, plantMonth: 4, gddBase: 0, gddMaturity: 1500 },
  { country: 'Canada', region: 'Saskatchewan', crop: 'Wheat (spring)', lat: 52.1, lon: -106.7, plantMonth: 5, gddBase: 0, gddMaturity: 1500 },
  { country: 'France', region: 'Beauce (Centre)', crop: 'Wheat (winter)', lat: 48.3, lon: 1.8, plantMonth: 10, gddBase: 0, gddMaturity: 1500 },
  { country: 'Ukraine', region: 'Cherkasy', crop: 'Wheat (winter)', lat: 49.5, lon: 32.0, plantMonth: 9, gddBase: 0, gddMaturity: 1500 },
  { country: 'India', region: 'Punjab', crop: 'Wheat', lat: 30.9, lon: 75.5, plantMonth: 11, gddBase: 0, gddMaturity: 1500 },
  { country: 'China', region: 'Henan', crop: 'Wheat (winter)', lat: 34.5, lon: 113.5, plantMonth: 10, gddBase: 0, gddMaturity: 1500 },
  { country: 'Egypt', region: 'Nile Delta', crop: 'Wheat', lat: 30.8, lon: 31.0, plantMonth: 11, gddBase: 0, gddMaturity: 1500 },
  { country: 'Australia', region: 'New South Wales', crop: 'Wheat', lat: -33.5, lon: 147.0, plantMonth: 5, gddBase: 0, gddMaturity: 1500 },
  // Maize / corn (base 10 °C, ≈ 1600 GDD)
  { country: 'USA', region: 'Iowa', crop: 'Maize', lat: 42.0, lon: -93.6, plantMonth: 5, gddBase: 10, gddMaturity: 1600 },
  { country: 'Mexico', region: 'Sinaloa', crop: 'Maize (winter)', lat: 25.0, lon: -108.0, plantMonth: 11, gddBase: 10, gddMaturity: 1600 },
  { country: 'Brazil', region: 'Paraná', crop: 'Maize (safrinha)', lat: -24.5, lon: -51.5, plantMonth: 2, gddBase: 10, gddMaturity: 1600 },
  { country: 'Argentina', region: 'Córdoba', crop: 'Maize', lat: -31.5, lon: -64.0, plantMonth: 10, gddBase: 10, gddMaturity: 1600 },
  // Rice (base 10 °C, ≈ 1800 GDD)
  { country: 'India', region: 'Andhra Pradesh', crop: 'Rice', lat: 16.5, lon: 80.5, plantMonth: 6, gddBase: 10, gddMaturity: 1800 },
  { country: 'China', region: 'Hunan', crop: 'Rice', lat: 28.2, lon: 112.9, plantMonth: 4, gddBase: 10, gddMaturity: 1800 },
  { country: 'Indonesia', region: 'Java', crop: 'Rice', lat: -7.5, lon: 110.5, plantMonth: 1, gddBase: 10, gddMaturity: 1800 },
  { country: 'Thailand', region: 'Central Plain', crop: 'Rice', lat: 14.0, lon: 100.5, plantMonth: 5, gddBase: 10, gddMaturity: 1800 },
  { country: 'Vietnam', region: 'Mekong Delta', crop: 'Rice', lat: 10.0, lon: 105.7, plantMonth: 1, gddBase: 10, gddMaturity: 1800 },
  // Soybean (base 10 °C, ≈ 1500 GDD)
  { country: 'USA', region: 'Illinois', crop: 'Soybean', lat: 40.0, lon: -89.0, plantMonth: 5, gddBase: 10, gddMaturity: 1500 },
  { country: 'Brazil', region: 'Mato Grosso', crop: 'Soybean', lat: -13.0, lon: -55.0, plantMonth: 10, gddBase: 10, gddMaturity: 1500 },
  { country: 'Argentina', region: 'Buenos Aires', crop: 'Soybean', lat: -34.5, lon: -59.0, plantMonth: 11, gddBase: 10, gddMaturity: 1500 },
  // Cotton (base 12 °C, ≈ 1800 GDD)
  { country: 'USA', region: 'Mississippi Delta', crop: 'Cotton', lat: 33.5, lon: -90.5, plantMonth: 5, gddBase: 12, gddMaturity: 1800 },
  { country: 'Uzbekistan', region: 'Fergana Valley', crop: 'Cotton', lat: 40.5, lon: 71.5, plantMonth: 4, gddBase: 12, gddMaturity: 1800 },
  // Sorghum / millet (base 10 °C, ≈ 1700 GDD)
  { country: 'Nigeria', region: 'Kano', crop: 'Sorghum', lat: 12.0, lon: 8.5, plantMonth: 6, gddBase: 10, gddMaturity: 1700 },
  // Barley (base 0 °C, ≈ 1300 GDD)
  { country: 'Spain', region: 'Castile-La Mancha', crop: 'Barley', lat: 39.5, lon: -3.0, plantMonth: 11, gddBase: 0, gddMaturity: 1300 },
];

/** Analysis window end (the Open-Meteo archive `end_date`). */
const END_YEAR = 2026;
const END_MONTH = 11;
const END_DATE = '2026-11-14';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DailyArchive {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  soil_moisture_0_to_7cm_mean: (number | null)[];
}

type Stage = 'growing' | 'maturing' | 'ready';

interface CropRow {
  region: CropRegion;
  plantDate: string;
  gdd: number;
  days: number;
  /** gdd / gddMaturity — may exceed 1 (GDD keeps accumulating past maturity). */
  pct: number;
  stage: Stage;
  precipMm: number | null;
  soilMoisture: number | null;
  error?: string;
}

const plantYearOf = (plantMonth: number) => (plantMonth <= END_MONTH ? END_YEAR : END_YEAR - 1);
const plantDateOf = (plantMonth: number) => `${plantYearOf(plantMonth)}-${String(plantMonth).padStart(2, '0')}-01`;
const archiveUrl = (r: CropRegion) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${r.lat}&longitude=${r.lon}&start_date=${plantYearOf(r.plantMonth)}-01-01&end_date=${END_DATE}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,soil_moisture_0_to_7cm_mean`;

/** Growing Degree Days since plant date: GDD += max(0, (tmax+tmin)/2 − base). Nulls are skipped. */
function computeRow(r: CropRegion, daily: DailyArchive): CropRow {
  const plantDate = plantDateOf(r.plantMonth);
  let gdd = 0;
  let days = 0;
  let precip = 0;
  let soil = 0;
  let soilN = 0;
  for (let i = 0; i < daily.time.length; i++) {
    if (daily.time[i] < plantDate) continue; // before planting
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    if (tmax == null || tmin == null) continue; // guard nulls
    gdd += Math.max(0, (tmax + tmin) / 2 - r.gddBase);
    days += 1;
    const p = daily.precipitation_sum[i];
    if (p != null) precip += p;
    const s = daily.soil_moisture_0_to_7cm_mean[i];
    if (s != null) { soil += s; soilN += 1; }
  }
  const pct = r.gddMaturity > 0 ? gdd / r.gddMaturity : 0;
  const stage: Stage = pct >= 0.95 ? 'ready' : pct >= 0.6 ? 'maturing' : 'growing';
  return { region: r, plantDate, gdd, days, pct, stage, precipMm: precip, soilMoisture: soilN ? soil / soilN : null };
}

const STAGE_STYLE: Record<Stage, { label: string; cls: string; bar: string }> = {
  growing: { label: 'Growing', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30', bar: '#fbbf24' },
  maturing: { label: 'Maturing', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30', bar: '#38bdf8' },
  ready: { label: 'READY TO REAP', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40', bar: '#34d399' },
};

function stageBadge(stage: Stage) {
  const s = STAGE_STYLE[stage];
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide ${s.cls}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.bar }} />{s.label}</span>;
}

type NotifState = 'idle' | 'unsupported' | 'granted' | 'denied';

export function CropWatch() {
  const [rows, setRows] = useState<CropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [notif, setNotif] = useState<NotifState>('idle');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFatal(null);
    Promise.all(
      CROP_REGIONS.map(async (r) => {
        try {
          const res = await fetch(archiveUrl(r));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = (await res.json()) as { daily?: DailyArchive };
          if (!j.daily) throw new Error('no daily block in response');
          return computeRow(r, j.daily);
        } catch (e) {
          return {
            region: r,
            plantDate: plantDateOf(r.plantMonth),
            gdd: 0,
            days: 0,
            pct: 0,
            stage: 'growing' as Stage,
            precipMm: null,
            soilMoisture: null,
            error: String((e as Error).message || e),
          };
        }
      })
    )
      .then((rs) => { if (alive) setRows(rs); })
      .catch((e) => { if (alive) setFatal(String((e as Error).message || e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  const ready = useMemo(() => rows.filter((r) => r.stage === 'ready').sort((a, b) => b.pct - a.pct), [rows]);
  const counts = useMemo(() => ({
    ready: rows.filter((r) => r.stage === 'ready').length,
    maturing: rows.filter((r) => r.stage === 'maturing').length,
    growing: rows.filter((r) => r.stage === 'growing').length,
    failed: rows.filter((r) => r.error).length,
  }), [rows]);

  const enableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) { setNotif('unsupported'); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNotif('denied'); return; }
      setNotif('granted');
      if (ready.length) {
        new Notification(`ORBIT CropWatch · ${ready.length} region${ready.length === 1 ? '' : 's'} ready to reap`, {
          body: ready.slice(0, 5).map((r) => `${r.region.country} · ${r.region.region} (${r.region.crop})`).join(' · ') + (ready.length > 5 ? ` · +${ready.length - 5} more` : ''),
        });
      } else {
        new Notification('ORBIT CropWatch · monitoring active', {
          body: 'No regions at harvest readiness yet. Alerts fire when a crop crosses 95% of its GDD threshold.',
        });
      }
    } catch { setNotif('denied'); }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        icon="Sprout"
        title="Crop Monitor · Harvest-readiness alerts"
        subtitle={`Growing-degree-day tracking across ${CROP_REGIONS.length} crop regions · challenge #6 Field Shift Rotation Planner`}
        right={
          <div className="flex items-center gap-2">
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setNonce((n) => n + 1)} disabled={loading}><Icon name="Radio" />Reload</button>
            <button className="btn-primary !py-1.5 text-xs" onClick={enableNotifications}><Icon name="Bell" />Notify me</button>
          </div>
        }
      />

      {/* Caveats — the GDD model is a heuristic, not an official advisory. */}
      <Glass className="p-3">
        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
          <Icon name="TriangleAlert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <b className="text-amber-200">Heuristic, not advice.</b> Growing Degree Days are a simple heat-accumulation model: a crop is flagged ready once it reaches ≥95% of an
            <b> approximate reference</b> GDD total. It does not account for soil nutrients, irrigation, disease, frost, varietal differences or multi-season/harvest-reset cycles, so
            &ldquo;READY TO REAP&rdquo; is a modelled signal, <b>not an official agronomic recommendation</b> — verify on the ground before harvesting. Registry coordinates, plant months and GDD thresholds are approximate reference values.
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip><StatusBadge status="live" note="Open-Meteo archive (live fetch)" /></Chip>
          {[
            'Wheat ≈1500 GDD (base 0°C)', 'Barley ≈1300 (0°C)', 'Maize ≈1600 (10°C)', 'Rice ≈1800 (10°C)', 'Soybean ≈1500 (10°C)', 'Cotton ≈1800 (12°C)', 'Sorghum/millet ≈1700 (10°C)',
          ].map((t) => <Chip key={t} className="border-amber-400/25 text-amber-200">{t} <span className="opacity-60">(approx.)</span></Chip>)}
        </div>
      </Glass>

      {/* Harvest-ready alerts — the prominent panel. */}
      <Glass className="border-emerald-400/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="Bell" className="h-5 w-5 text-emerald-300" />
            <div className="h-title">Harvest-ready alerts</div>
            {ready.length > 0 && <span className="live-dot rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-emerald-950">{ready.length}</span>}
          </div>
          <button className="btn-ghost !py-1.5 text-xs" onClick={enableNotifications}><Icon name="Bell" />Browser notification</button>
        </div>
        {notif === 'granted' && <p className="mt-1 text-[11px] text-emerald-300">Notifications enabled — a desktop alert was sent for the current ready list.</p>}
        {notif === 'denied' && <p className="mt-1 text-[11px] text-amber-300">Notification permission was denied or unavailable in this browser.</p>}
        {notif === 'unsupported' && <p className="mt-1 text-[11px] text-slate-400">This browser does not support the Notification API.</p>}

        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Fetching Open-Meteo archive for {CROP_REGIONS.length} regions…</p>
        ) : ready.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((r) => (
              <div key={`${r.region.country}-${r.region.region}`} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                <div>
                  <div className="text-sm font-semibold text-white">{r.region.country} · {r.region.region}</div>
                  <div className="text-[11px] text-slate-300">{r.region.crop} · planted {MONTHS[r.region.plantMonth - 1]}</div>
                  <div className="mt-1 text-[11px] text-emerald-200">{Math.round(r.gdd)} GDD of ≈{r.region.gddMaturity} ({Math.min(100, Math.round(r.pct * 100))}%)</div>
                </div>
                <Icon name="CircleCheck" className="h-6 w-6 shrink-0 text-emerald-300" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No region has crossed the 95% GDD threshold yet. Current split: {counts.growing} growing · {counts.maturing} maturing{counts.failed ? ` · ${counts.failed} fetch failed` : ''}.</p>
        )}
      </Glass>

      {/* Registry table / cards. */}
      <Glass className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="h-title">Crop-region registry ({CROP_REGIONS.length})</div>
          <div className="flex gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">{stageBadge('growing')}{counts.growing}</span>
            <span className="flex items-center gap-1">{stageBadge('maturing')}{counts.maturing}</span>
            <span className="flex items-center gap-1">{stageBadge('ready')}{counts.ready}</span>
          </div>
        </div>
        {fatal && <p className="px-4 pb-2 text-xs text-rose-300">Fetch failed: {fatal}</p>}
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-slate-400">
              <tr>
                <th className="p-2">Region</th>
                <th>Crop</th>
                <th>Planted</th>
                <th>GDD</th>
                <th>Progress</th>
                <th>Stage</th>
                <th>Rain (since plant)</th>
                <th>Soil moisture</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = `${r.region.country}-${r.region.region}`;
                const s = STAGE_STYLE[r.stage];
                const pctShown = Math.min(100, Math.round(r.pct * 100));
                return (
                  <tr key={key} className="border-t border-white/5 align-top hover:bg-sky-500/5">
                    <td className="p-2">
                      <div className="font-semibold text-white">{r.region.country} · {r.region.region}</div>
                      <div className="text-[10px] text-slate-500">{r.region.lat.toFixed(1)}°, {r.region.lon.toFixed(1)}°</div>
                    </td>
                    <td className="p-2 text-slate-200">{r.region.crop}</td>
                    <td className="p-2 whitespace-nowrap text-slate-300">{MONTHS[r.region.plantMonth - 1]} {r.plantDate.slice(0, 4)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {r.error ? <span className="text-rose-300">—</span> : <><b className="text-white">{Math.round(r.gdd)}</b><span className="text-slate-500"> / ≈{r.region.gddMaturity}</span></>}
                    </td>
                    <td className="p-2 min-w-[120px]">
                      {r.error ? <span className="text-rose-300">{r.error}</span> : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded bg-white/10"><div className="h-1.5 rounded" style={{ width: `${pctShown}%`, background: s.bar }} /></div>
                          <span className="text-slate-300">{pctShown}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-2">{stageBadge(r.stage)}</td>
                    <td className="p-2 whitespace-nowrap text-slate-300">{r.precipMm == null ? '—' : `${r.precipMm.toFixed(0)} mm`}</td>
                    <td className="p-2 whitespace-nowrap text-slate-300">{r.soilMoisture == null ? '—' : `${(r.soilMoisture * 100).toFixed(0)}% vol`}</td>
                    <td className="p-2">{r.error ? <StatusBadge status="not connected" note={r.error} /> : <StatusBadge status="live" note="Open-Meteo archive" />}</td>
                  </tr>
                );
              })}
              {!rows.length && !loading && !fatal && (
                <tr><td colSpan={9} className="p-3 text-slate-500">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
          Live daily temperature, precipitation and surface soil moisture from the Open-Meteo historical archive (end date {END_DATE}). GDD is accumulated from each region&rsquo;s approximate planting date only; values that exceed the maturity threshold are shown at 100% but the stage is derived from the raw GDD.
        </div>
      </Glass>
    </div>
  );
}

export default CropWatch;
