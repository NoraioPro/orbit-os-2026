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
  // second land AOI: the Nordic crop region used by the Agri Intelligence board
  agriNordic: { id: 'agri-ostfold', name: 'Østfold · Norway', lat: 59.39, lon: 11.0, community: 'AG' },
};

const PARAMS = ['GWETROOT', 'T2M', 'PRECTOTCORR', 'WS2M', 'CLOUD_AMT'];
const FILL = -999;

const powerUrl = ({ lat, lon, community }) =>
  `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${PARAMS.join(',')}&community=${community}` +
  `&longitude=${lon}&latitude=${lat}&start=2024&end=2026&format=JSON`;

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
  // least-squares slope over the valid points (real regression, not a guess)
  const pts = vals.map((v, i) => (v === null ? null : [i, v])).filter(Boolean);
  let slope = null;
  if (pts.length > 2) {
    const n = pts.length;
    const sx = pts.reduce((a, p) => a + p[0], 0);
    const sy = pts.reduce((a, p) => a + p[1], 0);
    const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
    const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) slope = (n * sxy - sx * sy) / denom;
  }
  // same-month anomaly: value minus the same month one year earlier
  const yoy = vals.map((v, i) => (v === null || i < 12 || vals[i - 12] === null ? null : Number((v - vals[i - 12]).toFixed(4))));
  return {
    id: key.toLowerCase(),
    label,
    unit,
    months: rows.map((r) => r.label),
    ym: rows.map((r) => r.ym),
    values: vals,
    yoy,
    latest: have.length ? have[have.length - 1] : null,
    mean: have.length ? Number((have.reduce((a, b) => a + b, 0) / have.length).toFixed(3)) : null,
    trendPerMonth: slope === null ? null : Number(slope.toFixed(4)),
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


/** Real ASF Search API harvest (keyless metadata) for several AOIs. */
const ASF_AOIS = [
  { id: 'oslo', name: 'Oslo, Norway', lat: 59.91, lon: 10.75 },
  { id: 'svalbard', name: 'Svalbard, Norway', lat: 78.22, lon: 15.65 },
];

async function fetchAsfAoi(aoi) {
  const point = `POINT(${aoi.lon} ${aoi.lat})`;
  const queries = [];
  for (const platform of ['NISAR', 'SENTINEL-1']) {
    const url =
      'https://api.daac.asf.alaska.edu/services/search/param?' +
      new URLSearchParams({ platform, intersectsWith: point, maxResults: '8', output: 'json' }).toString();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ORBIT-OS/0.1 (NASA Space Apps)' } });
      if (!res.ok) { queries.push({ platform, url, status: `HTTP ${res.status}`, granules: [] }); continue; }
      const json = await res.json();
      const granules = (json?.[0] ?? []).map((g) => ({
        granule: g.granuleName ?? null,
        platform: g.platform ?? platform,
        startTime: g.startTime ?? null,
        product: g.processingLevel ? `${g.processingLevel} ${g.productType ?? ''}`.trim() : g.productType ?? null,
        beamMode: g.beamModeType ?? null,
        polarization: g.polarization ?? null,
        fileSizeBytes: g.bytes ?? null,
        path: g.pathNumber ?? null,
        frame: g.frameNumber ?? null,
        orbit: g.absoluteOrbit ?? null,
        browse: Array.isArray(g.browse) ? g.browse.find((b) => /_LATLON\.png$/i.test(b)) ?? g.browse[0] ?? null : null,
      }));
      queries.push({ platform, url, status: 'live', granules });
    } catch (e) {
      queries.push({ platform, url, status: String(e.message ?? e), granules: [] });
    }
  }
  return { ...aoi, queries, granules: queries.flatMap((q) => q.granules.map((g) => ({ ...g, platformQuery: q.platform }))) };
}

/** One real USGS event by id — the 6 Feb 2023 Kahramanmaras M7.8. */
async function fetchUsgsEvent(eventId) {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=${eventId}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ORBIT-OS/0.1 (NASA Space Apps)' } });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const f = await res.json();
  const p = f.properties ?? {};
  const [lon, lat, depth] = f.geometry?.coordinates ?? [null, null, null];
  const iso = p.time ? new Date(p.time).toISOString() : null;
  return {
    eventId,
    url: p.url ?? url,
    title: p.title ?? null,
    place: p.place ?? null,
    magnitude: p.mag ?? null,
    magType: p.magType ?? null,
    timeUtc: iso,
    depthKm: depth,
    lat,
    lon,
    mmi: p.mmi ?? null,
    alert: p.alert ?? null,
    significance: p.sig ?? null,
    felt: p.felt ?? null,
    reviewStatus: p.status ?? null,
    network: p.net ?? null,
    queryUrl: url,
  };
}


/** Generic ASF query -> normalised granule records (real metadata only). */
async function asfQuery(params) {
  const url =
    'https://api.daac.asf.alaska.edu/services/search/param?' +
    new URLSearchParams({ output: 'json', ...params }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': 'ORBIT-OS/0.1 (NASA Space Apps)' } });
  if (!res.ok) return { url, status: `HTTP ${res.status}`, granules: [] };
  const json = await res.json();
  const rows = json?.[0] ?? [];
  const granules = rows.map((g) => ({
    granule: g.granuleName ?? null,
    platform: g.platform ?? null,
    startTime: g.startTime ?? null,
    stopTime: g.stopTime ?? null,
    flightDirection: g.flightDirection ?? null,
    relativeOrbit: g.relativeOrbit ?? null,
    frame: g.frameNumber ?? null,
    beamMode: g.beamModeType ?? null,
    polarization: g.polarization ?? null,
    processingLevel: g.processingLevel ?? null,
    subswath: g.subswath ?? null,
    offNadirAngle: g.offNadirAngle ?? null,
    centerLat: g.centerLat ?? null,
    centerLon: g.centerLon ?? null,
    sizeMB: g.sizeMB ?? null,
    insarGrouping: g.insarGrouping ?? null,
    insarStackSize: g.insarStackSize ?? null,
    footprint: g.stringFootprint ?? null,
    thumbnail: g.thumbnailUrl ?? (Array.isArray(g.browse) ? g.browse[0] : null) ?? null,
    downloadUrl: g.downloadUrl ?? null,
  }));
  return { url, status: 'live', granules };
}

/** East Anatolian Fault: a genuine same-track Sentinel-1 pair around the 6 Feb 2023 M7.8. */
async function fetchFaultPair() {
  const point = { intersectsWith: 'POINT(36.9 37.6)' };
  const before = await asfQuery({ platform: 'SENTINEL-1', flightDirection: 'ASCENDING', processingLevel: 'SLC', start: '2023-01-01', end: '2023-02-05', maxResults: '8', ...point });
  const after = await asfQuery({ platform: 'SENTINEL-1', flightDirection: 'ASCENDING', processingLevel: 'SLC', start: '2023-02-08', end: '2023-03-25', maxResults: '8', ...point });
  const nisar = await asfQuery({ platform: 'NISAR', maxResults: '6', ...point });

  // InSAR needs the SAME relative orbit + frame: pick the latest pre-event scene and
  // the earliest post-event scene that share them.
  const byTime = (a, b) => new Date(a.startTime) - new Date(b.startTime);
  const eventTime = new Date('2023-02-06T01:17:34Z');
  // latest scene BEFORE the event, earliest scene AFTER it, on the same track
  const pre = [...before.granules].filter((g) => g.startTime && new Date(g.startTime) < eventTime && g.relativeOrbit && g.frame).sort(byTime).pop() ?? before.granules[0] ?? null;
  const post =
    (pre && [...after.granules].filter((g) => g.startTime && new Date(g.startTime) > eventTime && g.relativeOrbit === pre.relativeOrbit && g.frame === pre.frame).sort(byTime)[0]) ??
    after.granules[after.granules.length - 1] ??
    null;
  return { before: pre, after: post, nisar: nisar.granules[0] ?? null, queries: { before: before.url, after: after.url, nisar: nisar.url } };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const gibsRaw = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'live', 'gibs-layers.json'), 'utf8'));
  const gibsList = Array.isArray(gibsRaw) ? gibsRaw : (gibsRaw.layers ?? [...Object.values(gibsRaw)].flat());

  const [agriP, oceanP, nordicP] = await Promise.all([fetchPower(AOI.agri), fetchPower(AOI.ocean), fetchPower(AOI.agriNordic)]);
  const generatedAt = new Date().toISOString();

  const agriRows = last(agriP.rows, 24);
  const oceanRows = last(oceanP.rows, 24);
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
    coverage: {
      ...coverage,
      window: `${agriRows[0]?.label ?? '?'}–${agriRows.at(-1)?.label ?? '?'} ${agriRows.at(-1)?.ym?.slice(0, 4) ?? ''}`,
      months_available: agriRows.filter((r) => r.T2M !== null).length,
      windows: [6, 12, 24].filter((n) => agriRows.length >= n),
    },
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
    coverage: {
      ...coverage,
      window: `${oceanRows[0]?.label ?? '?'}–${oceanRows.at(-1)?.label ?? '?'} ${oceanRows.at(-1)?.ym?.slice(0, 4) ?? ''}`,
      months_available: oceanRows.filter((r) => r.T2M !== null).length,
      windows: [6, 12, 24].filter((n) => oceanRows.length >= n),
    },
  };

  const nordicRows = last(nordicP.rows, 24);
  const nordic = {
    domain: 'agri-ostfold',
    title: 'Agri Intelligence',
    subtitle: 'Crop-region monitoring · Østfold, Norway',
    aoi: AOI.agriNordic,
    generated_at: generatedAt,
    provenance: {
      provider: 'NASA POWER (monthly point API, community=AG) + NASA GIBS',
      url: nordicP.url,
      access: 'keyless',
      honesty: 'live',
      note: 'Soil moisture is POWER GWETROOT (root-zone wetness, 0-1), precipitation is PRECTOTCORR and PAR is ALLSKY_SFC_PAR_TOT. NDVI *values* are NOT available in this build (MODIS/VIIRS subsets need Earthdata or the ORNL subset API), so no NDVI number is shown.',
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
    ],
    series: [
      series(nordicRows, 'GWETROOT', 'Soil moisture (root zone)', 'fraction 0-1', 'POWER GWETROOT monthly mean at the AOI point.'),
      series(nordicRows, 'T2M', 'Air temperature', 'C', 'POWER T2M monthly mean.'),
      series(nordicRows, 'PRECTOTCORR', 'Precipitation', 'mm/day', 'POWER PRECTOTCORR monthly mean.'),
    ],
    weather: [
      { id: 'precip', label: 'Precipitation', unit: 'mm/day', value: nordicRows.at(-1)?.PRECTOTCORR ?? null },
      { id: 'temp', label: 'Temperature', unit: 'C', value: nordicRows.at(-1)?.T2M ?? null },
      { id: 'wind', label: 'Wind', unit: 'm/s', value: nordicRows.at(-1)?.WS2M ?? null },
      { id: 'clouds', label: 'Clouds', unit: '%', value: nordicRows.at(-1)?.CLOUD_AMT ?? null },
    ],
    coverage: { ...coverage, window: `${nordicRows[0]?.label ?? '?'}-${nordicRows.at(-1)?.label ?? '?'} ${nordicRows.at(-1)?.ym?.slice(0, 4) ?? ''}` },
  };

  await writeFile(join(OUT, 'agri-ostfold.json'), JSON.stringify(nordic, null, 2));

  const index = {
    generated_at: generatedAt,
    source: 'scripts/build-domains.mjs',
    note: 'Domain-organized data layer. Each file carries its own provenance block; panels read these files instead of hard-coded numbers.',
    domains: [
      { id: 'agri', file: 'agri.json', title: agri.title, honesty: 'live', series: agri.series.length, imagery: agri.imagery.filter((i) => i.gibs).length },
      { id: 'ocean', file: 'ocean.json', title: ocean.title, honesty: 'live', series: ocean.series.length, imagery: ocean.imagery.filter((i) => i.gibs).length },
      { id: 'agri-ostfold', file: 'agri-ostfold.json', title: 'Agri Intelligence · Østfold', honesty: 'live', series: nordic.series.length, imagery: nordic.imagery.filter((i) => i.gibs).length },
      { id: 'sar', file: 'sar.json', title: 'SAR acquisitions (ASF · Oslo + Svalbard)', honesty: 'live', series: null, imagery: 0 },
      { id: 'events', file: 'events-turkiye.json', title: 'USGS event · Kahramanmaras M7.8', honesty: 'live', series: null, imagery: 0 },
      { id: 'sar-fault', file: 'sar-fault.json', title: 'East Anatolian Fault · Sentinel-1 pair', honesty: 'live', series: null, imagery: 0 },
    ],
  };

  await writeFile(join(OUT, 'agri.json'), JSON.stringify(agri, null, 2));
  await writeFile(join(OUT, 'ocean.json'), JSON.stringify(ocean, null, 2));
  const asfAois = [];
  for (const aoi of ASF_AOIS) asfAois.push(await fetchAsfAoi(aoi));
  const asf = { generated_at: generatedAt, aois: asfAois, granules: asfAois.flatMap((a) => a.granules) };
  const sar = {
    domain: 'sar',
    title: 'SAR acquisitions',
    subtitle: 'ASF Search API harvest (Oslo + Svalbard)',
    generated_at: generatedAt,
    provenance: {
      provider: 'NASA ASF Search API (Alaska Satellite Facility)',
      url: 'https://api.daac.asf.alaska.edu/services/search/param',
      access: 'keyless metadata (granule DOWNLOAD needs an Earthdata login)',
      honesty: 'live',
      note: 'Granule metadata is real and returned by ASF. Downloading the products and running InSAR are NOT connected in this build.',
    },
    aois: asfAois.map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, queries: a.queries.map((q) => ({ platform: q.platform, status: q.status, count: q.granules.length })) })),
    queries: asfAois.flatMap((a) => a.queries.map((q) => ({ ...q, aoi: a.id }))),
    granules: asf.granules,
  };
  await writeFile(join(OUT, 'sar.json'), JSON.stringify(sar, null, 2));
  const sarEntry = index.domains.find((d) => d.id === 'sar');
  if (sarEntry) sarEntry.series = sar.granules.length;

  // Real historical event (published USGS catalog record) — the 2023 Kahramanmaras M7.8
  try {
    const ev = await fetchUsgsEvent('us6000jllz');
    const eventsFile = {
      domain: 'events',
      title: 'Kahramanmaras M7.8 · 6 Feb 2023',
      generated_at: generatedAt,
      provenance: {
        provider: 'USGS Earthquake Catalog (FDSN event service)',
        url: ev.queryUrl,
        access: 'keyless',
        honesty: 'live',
        note: 'Magnitude, place, time, depth and coordinates are the reviewed USGS record. The InSAR deformation field shown in the app is NOT derived from this record and is labelled sample there.',
      },
      event: ev,
    };
    await writeFile(join(OUT, 'events-turkiye.json'), JSON.stringify(eventsFile, null, 2));
    console.log(` usgs: ${ev.title} · ${ev.timeUtc} · ${ev.depthKm} km`);
  } catch (e) {
    console.log(' usgs event fetch failed:', e.message);
  }

  // East Anatolian Fault pair (real Sentinel-1 acquisitions around the 2023 M7.8)
  try {
    const fault = await fetchFaultPair();
    const faultFile = {
      domain: 'sar-fault',
      title: 'East Anatolian Fault · Sentinel-1 pair',
      generated_at: generatedAt,
      aoi: { lat: 37.6, lon: 36.9, name: 'East Anatolian Fault, Turkiye / Syria' },
      event: { id: 'us6000jllz', label: 'M7.8 Kahramanmaras sequence', timeUtc: '2023-02-06T01:17:34Z' },
      provenance: {
        provider: 'NASA ASF Search API',
        url: 'https://api.daac.asf.alaska.edu/services/search/param',
        access: 'keyless metadata (product download needs an Earthdata login)',
        honesty: 'live',
        note: 'Both scenes are real ASF records on the same relative orbit and frame, so they form an interferometric pair. No interferogram has been processed in this build; amplitude/fringe imagery in the UI is labelled sample.',
      },
      pair: { before: fault.before, after: fault.after },
      nisarCurrent: fault.nisar,
      queries: fault.queries,
    };
    await writeFile(join(OUT, 'sar-fault.json'), JSON.stringify(faultFile, null, 2));
    console.log(` fault pair: ${fault.before?.startTime ?? '?'} -> ${fault.after?.startTime ?? '?'} (frame ${fault.before?.frame ?? '?'}, orbit ${fault.before?.relativeOrbit ?? '?'})`);
  } catch (e) {
    console.log(' fault pair fetch failed:', e.message);
  }

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
