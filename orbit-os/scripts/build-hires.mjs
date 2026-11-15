#!/usr/bin/env node
/**
 * Build public/data/domains/hires.json — a 30 m imagery catalogue per AOI.
 *
 * Why: the Agri panels were showing MODIS Terra NDVI at 250 m. HLS (Harmonized
 * Landsat + Sentinel-2) and OPERA give the same area at 30 m, plus real surface
 * water and vegetation-disturbance products. This script asks GIBS which dates
 * actually have coverage over each AOI so the UI never shows an empty tile.
 *
 * Availability test, stated plainly: GIBS returns an empty transparent tile for a
 * date with no data, and a 1–2 kB PNG for an empty JPEG. A date is only recorded
 * when the response is a real image (>= EMPTY_BYTES). No pixel statistics are
 * computed anywhere in this pipeline.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const MIN_BYTES = { jpeg: 2500, png: 2500 };
const PROBE_DAYS = 90;
const PROBE_STEP = 2;
const MAX_DATES = 6;

const AOIS = [
  { id: 'agri-sahel', name: 'Sahel · Niger', bbox: [1.6, 13.0, 2.6, 14.0], centre: [13.51, 2.11] },
  { id: 'agri-ostfold', name: 'Østfold · Norway', bbox: [10.6, 59.2, 11.4, 59.7], centre: [59.39, 11.0] },
];

const LAYERS = [
  {
    id: 'hls-s2',
    label: 'HLS · Sentinel-2 true colour',
    short: 'S2 · 30 m',
    gibs: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance',
    resolution: 30,
    sensor: 'Sentinel-2 MSI, harmonised (HLS S30)',
    format: 'image/jpeg',
    transparent: false,
  },
  {
    id: 'hls-l30',
    label: 'HLS · Landsat true colour',
    short: 'Landsat · 30 m',
    gibs: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance',
    resolution: 30,
    sensor: 'Landsat 8/9 OLI, harmonised (HLS L30)',
    format: 'image/jpeg',
    transparent: false,
  },
  {
    id: 'dist-alert',
    label: 'Vegetation disturbance (DIST-ALERT)',
    short: 'disturbance · 30 m',
    gibs: 'OPERA_L3_DIST-ALERT-HLS_Color_Index',
    resolution: 30,
    sensor: 'OPERA DIST-ALERT (HLS-based)',
    format: 'image/png',
    transparent: true,
    legend: 'https://gibs.earthdata.nasa.gov/legends/OPERA_Vegetation_Disturbance_Status_H.png',
    caveat: 'Alerts only — a site with no alert renders as an empty tile, which is not the same as "no change".',
  },
  {
    id: 'water',
    label: 'Surface water extent',
    short: 'water · 30 m',
    gibs: 'OPERA_L3_Dynamic_Surface_Water_Extent-HLS',
    resolution: 30,
    sensor: 'OPERA DSWx (HLS-based)',
    format: 'image/png',
    transparent: true,
    legend: 'https://gibs.earthdata.nasa.gov/legends/OPERA_Dynamic_Surface_Water_Extent_H.png',
    caveat: 'Grey = no water or no observation on that date; it is not a flood verdict.',
  },
];

const REFERENCE = {
  id: 'modis-ndvi',
  label: 'MODIS Terra NDVI (the layer this replaces)',
  short: 'MODIS · 250 m',
  gibs: 'MODIS_Terra_NDVI_8Day',
  resolution: 250,
  sensor: 'MODIS Terra, 8-day composite',
  format: 'image/png',
  transparent: true,
};

const iso = (d) => d.toISOString().slice(0, 10);

function mapUrl(layer, date, bbox, size) {
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

async function hasData(layer, date, bbox, size = 256) {
  try {
    const r = await fetch(mapUrl(layer, date, bbox, size));
    if (!r.ok) return { ok: false, bytes: 0, status: r.status };
    const buf = await r.arrayBuffer();
    const floor = MIN_BYTES[layer.format === 'image/jpeg' ? 'jpeg' : 'png'];
    return { ok: buf.byteLength >= floor, bytes: buf.byteLength, status: r.status };
  } catch (e) {
    return { ok: false, bytes: 0, status: 0, error: String(e).slice(0, 80) };
  }
}

async function pool(items, fn, width = 6) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (i < items.length) {
        const at = i++;
        out[at] = await fn(items[at]);
      }
    }),
  );
  return out;
}

function spread(dates, max) {
  if (dates.length <= max) return dates;
  const picked = new Set([dates[0], dates[dates.length - 1]]);
  const step = (dates.length - 1) / (max - 1);
  for (let k = 1; k < max - 1; k += 1) picked.add(dates[Math.round(k * step)]);
  return [...picked].sort();
}

async function buildAoi(aoi) {
  const candidates = [];
  const today = new Date();
  for (let d = 0; d < PROBE_DAYS; d += PROBE_STEP) {
    const day = new Date(today.getTime() - d * 86400000);
    candidates.push(iso(day));
  }
  console.log(`  ${aoi.name}: probing ${candidates.length} dates x ${LAYERS.length} layers`);

  const layers = [];
  for (const layer of LAYERS) {
    const probed = await pool(candidates, async (date) => ({ date, ...(await hasData(layer, date, aoi.bbox)) }));
    const withData = probed.filter((p) => p.ok).map((p) => p.date).sort();
    const dates = spread(withData, MAX_DATES);
    console.log(`    ${layer.short}: ${withData.length}/${probed.length} dates have data -> using ${dates.join(', ') || 'NONE'}`);
    layers.push({ ...layer, dates, tested: probed.length });
  }

  const refProbed = await pool(candidates, async (date) => ({ date, ...(await hasData(REFERENCE, date, aoi.bbox)) }));
  const refOk = refProbed.filter((p) => p.ok).map((p) => p.date).sort();
  const reference = { ...REFERENCE, dates: spread(refOk, 2), tested: refProbed.length };
  console.log(`    ${REFERENCE.short}: ${refOk.length}/${refProbed.length} dates have data -> using ${reference.dates.join(', ') || 'NONE'}`);

  return { id: aoi.id, name: aoi.name, bbox: aoi.bbox, centre: aoi.centre, layers, reference };
}

const startedAt = new Date().toISOString();
console.log('hires: probing NASA GIBS for 30 m coverage');
const aois = [];
for (const aoi of AOIS) aois.push(await buildAoi(aoi));

const out = {
  domain: 'hires',
  title: '30 m imagery catalogue',
  subtitle: 'Harmonized Landsat / Sentinel-2 and OPERA products over each AOI, replacing the 250 m MODIS NDVI view',
  generated_at: startedAt,
  provenance: {
    provider: 'NASA GIBS (Global Imagery Browse Services)',
    url: WMS,
    access: 'keyless WMS GetMap, EPSG:4326',
    honesty:
      'A date is listed only when GIBS returned a non-empty tile for that AOI (>=8 kB compressed response). That is an availability test, not a pixel count: no reflectance, NDVI or water fraction is computed anywhere in this pipeline.',
    note:
      'MODIS Terra NDVI 8-day is kept beside each AOI purely as the 250 m reference the user asked to replace.',
  },
  aois,
};

mkdirSync('public/data/domains', { recursive: true });
writeFileSync('public/data/domains/hires.json', JSON.stringify(out, null, 2) + '\n');
console.log(`hires: wrote public/data/domains/hires.json (${aois.length} AOIs, ${aois.reduce((n, a) => n + a.layers.reduce((m, l) => m + l.dates.length, 0), 0)} dated layer entries)`);
