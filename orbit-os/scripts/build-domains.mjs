/**
 * Builds the domain data layer that backs the Unified Geospatial view
 * (Agri × Ocean) and the Data Hub's domain grouping.
 *
 * Everything written here comes from a real, keyless source:
 *   - NASA POWER monthly point API  (soil moisture, air temperature,
 *     precipitation, wind, cloud amount) for one land AOI and one marine AOI.
 *   - NASA GIBS layer catalogue (already harvested into live/gibs-layers.json)
 *     for the imagery layers we point the map thumbnails at.
 *
 * Nothing is invented: a parameter that POWER returns as fill (-999) becomes
 * null, and a layer GIBS does not publish is not listed.
 *
 *   node scripts/build-domains.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'domains');

const AOI = {
  agri: { id: 'agri-sahel', name: 'Sahel · Niger', lat: 13.51, lon: 2.11, community: 'AG' },
  ocean: { id: 'ocean-gulfstream', name: 'Gulf Stream · 38N 50W', lat: 38.0, lon: -50.0, community: 'RE' },
};

const PARAMS = ['GWETROOT', 'T2M', 'PRECTOTCORR', 'WS2M', 'CLOUD_AMT'];
const FILL = -999;

const powerUrl = ({ lat, lon, community }) =>
  `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${PARAMS.join(',')}&community=${community}` +
  `&longitude=${lon}&latitude=${lat}&start=2025&end=2026&format=JSON`;

async function fetchPower(aoi) {
  const url = powerUrl(aoi);
  const res = await fetch(url, { headers: { 'User-Agent': 'ORBIT-OS/0.1 (NASA Space Apps)' } });
  if (!res.ok) throw new Error(`POWER ${res.status} for ${aoi.id}`);
  const json = await res.json();
  const params = json?.properties?.parameter ?? {};
  const keys = Object.keys(params.GWETROOT ?? params.T2M ?? {});
  // keep only complete months whose key is YYYYMM and that carry a real value
  const months = keys
    .filter((k) => /^\d{6}$/.test(k))
    .sort()
    .filter((k) => {
      const v = params.T2M?.[k];
      return typeof v === 'number' && v !== FILL;
    });
  const pick = (p, k) => {
    const v = params[p]?.[k];
    return typeof v === 'number' && v !== FILL ? v : null;
  };
  const rows = months.map((k) => ({
    ym: k,
    label: monthLabel(k),
    GWETROOT: pick('GWETROOT', k),
    T2M: pick('T2M', k),
    PRECTOTCORR: pick('PRECTOTCORR', k),
    WS2M: pick('WS2M', k),
    CLOUD_AMT: pick('CLOUD_AMT', k),
  }));
  return { url, rows, header: json?.header ?? null, units: json?.parameters ?? null };
}

function monthLabel(ym) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = Number(ym.slice(4, 6));
  return names[m - 1] ?? ym;
}

function last(rows, n) {
  return rows.filter((r) => r.T2M !== null).slice(-n);
}

function series(rows, key, label, unit, note) {
  const vals = rows.map((r) => r[key]);
  const have = vals.filter((v) => v !== null);
  return {
    id: key.toLowerCase(),
    label,
    unit,
    months: rows.map((r) => r.label),
    values: vals,
    latest: have.length ? have[have.length - 1] : null,
    mean: have.length ? Number((have.reduce((a, b) => a + b, 0) / have.length).toFixed(3)) : null,
    note,
  };
}

function gibsPick(layers, ids) {
  const out = [];
  for (const id of ids) {
    const l = layers.find((x) => x.id === id);
    if (l) out.push({ gibs: l.id, title: l.title, theme: l.theme, maxLevel: l.max_level ?? null });
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const gibsRaw = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'live', 'gibs-layers.json'), 'utf8'));
  const gibsList = Array.isArray(gibsRaw) ? gibsRaw : (gibsRaw.layers ?? [...Object.values(gibsRaw)].flat());

  const [agriP, oceanP] = await Promise.all([fetchPower(AOI.agri), fetchPower(AOI.ocean)]);
  const generatedAt = new Date().toISOString();

  const agriRows = last(agriP.rows, 6);
  const oceanRows = last(oceanP.rows, 6);
  const coverage = {
    start: agriP.rows[0]?.ym ? `${agriP.rows[0].ym.slice(0, 4)}-${agriP.rows[0].ym.slice(4)}` : null,
    end: agriP.rows.at(-1)?.ym ? `${agriP.rows.at(-1).ym.slice(0, 4)}-${agriP.rows.at(-1).ym.slice(4)}` : null,
  };

  const agri = {
    domain: 'agri',
    title: 'Agri Intelligence',
    subtitle: 'Satellite insights for agriculture',
    aoi: AOI.agri,
    generated_at: generatedAt,
    provenance: {
      provider: 'NASA POWER (monthly point API, community=AG)',
      url: agriP.url,
      access: 'keyless',
      honesty: 'live',
      note: 'Soil moisture is POWER GWETROOT (root-zone soil wetness, 0–1). Panels label it as such; it is not a MODIS/SMAP retrieval.',
    },
    imagery: [
      {
        id: 'crop-health',
        title: 'Crop health',
        label: 'NDVI · MODIS Terra 8-day',
        status: 'live',
        note: 'Rendered from NASA GIBS tiles for the AOI window; no local pixel values are computed.',
        ...gibsPick(gibsList, ['MODIS_Terra_NDVI_8Day', 'VIIRS_SNPP_NDVI_8Day'])[0],
      },
      {
        id: 'soil-moisture-map',
        title: 'Soil moisture',
        label: 'GWETROOT · POWER point',
        status: 'live',
        note: 'Point value for the AOI centre, not a spatial map.',
      },
    ],
    series: [
      series(agriRows, 'GWETROOT', 'Soil moisture (root zone)', 'fraction 0–1', 'POWER GWETROOT monthly mean at the AOI point.'),
      series(agriRows, 'PRECTOTCORR', 'Precipitation', 'mm/day', 'POWER PRECTOTCORR monthly mean.'),
    ],
    weather: [
      { id: 'precip', label: 'Precipitation', unit: 'mm/day', value: agriRows.at(-1)?.PRECTOTCORR ?? null },
      { id: 'temp', label: 'Temperature', unit: '°C', value: agriRows.at(-1)?.T2M ?? null },
      { id: 'wind', label: 'Wind', unit: 'm/s', value: agriRows.at(-1)?.WS2M ?? null },
      { id: 'clouds', label: 'Clouds', unit: '%', value: agriRows.at(-1)?.CLOUD_AMT ?? null },
    ],
    coverage: { ...coverage, window: `${agriRows[0]?.label ?? '?'}–${agriRows.at(-1)?.label ?? '?'} ${agriRows.at(-1)?.ym?.slice(0, 4) ?? ''}` },
  };

  const ocean = {
    domain: 'ocean',
    title: 'Ocean Intelligence',
    subtitle: 'Ocean conditions and ecosystem insights',
    aoi: AOI.ocean,
    generated_at: generatedAt,
    provenance: {
      provider: 'NASA POWER (monthly point API over ocean, community=RE) + NASA GIBS',
      url: oceanP.url,
      access: 'keyless',
      honesty: 'live',
      note: 'POWER over ocean is marine AIR temperature (T2M), not sea-surface temperature. SST comes from the GHRSST MUR layer via GIBS imagery only. Chlorophyll (PACE/MODIS ocean colour) is NOT connected — no values are shown.',
    },
    imagery: [
      {
        id: 'sst',
        title: 'Sea-surface temperature',
        label: 'GHRSST MUR L4',
        status: 'live',
        note: 'GIBS raster for the AOI window; the app does not read pixel values.',
        ...gibsPick(gibsList, ['GHRSST_L4_MUR_Sea_Surface_Temperature', 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies'])[0],
      },
      {
        id: 'chlorophyll',
        title: 'Chlorophyll',
        label: 'Ocean colour · not connected',
        status: 'not connected',
        note: 'PACE/MODIS ocean-colour is a planned connector. No values or imagery are shown rather than a placeholder that could be mistaken for data.',
      },
    ],
    series: [
      series(oceanRows, 'T2M', 'Marine air temperature', '°C', 'POWER T2M over the ocean AOI — air temperature, NOT SST.'),
      series(oceanRows, 'WS2M', 'Wind speed at 2 m', 'm/s', 'POWER WS2M monthly mean over the AOI.'),
    ],
    weather: [
      { id: 'precip', label: 'Precipitation', unit: 'mm/day', value: oceanRows.at(-1)?.PRECTOTCORR ?? null },
      { id: 'temp', label: 'Temperature', unit: '°C', value: oceanRows.at(-1)?.T2M ?? null },
      { id: 'wind', label: 'Wind', unit: 'm/s', value: oceanRows.at(-1)?.WS2M ?? null },
      { id: 'clouds', label: 'Clouds', unit: '%', value: oceanRows.at(-1)?.CLOUD_AMT ?? null },
    ],
    coverage: { ...coverage, window: `${oceanRows[0]?.label ?? '?'}–${oceanRows.at(-1)?.label ?? '?'} ${oceanRows.at(-1)?.ym?.slice(0, 4) ?? ''}` },
  };

  const index = {
    generated_at: generatedAt,
    source: 'scripts/build-domains.mjs',
    note: 'Domain-organized data layer. Each file carries its own provenance block; panels read these files instead of hard-coded numbers.',
    domains: [
      { id: 'agri', file: 'agri.json', title: agri.title, honesty: 'live', series: agri.series.length, imagery: agri.imagery.filter((i) => i.gibs).length },
      { id: 'ocean', file: 'ocean.json', title: ocean.title, honesty: 'live', series: ocean.series.length, imagery: ocean.imagery.filter((i) => i.gibs).length },
    ],
  };

  await writeFile(join(OUT, 'agri.json'), JSON.stringify(agri, null, 2));
  await writeFile(join(OUT, 'ocean.json'), JSON.stringify(ocean, null, 2));
  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log('wrote', OUT);
  for (const d of [agri, ocean]) {
    console.log(` ${d.domain}: ${d.series.map((s) => `${s.id}=[${s.values.join(',')}]`).join(' | ')}`);
    console.log(`   weather: ${d.weather.map((w) => `${w.id}=${w.value}`).join(' ')}`);
  }
}

main().catch((e) => {
  console.error('build-domains failed:', e.message);
  process.exit(1);
});
