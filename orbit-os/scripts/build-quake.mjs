#!/usr/bin/env node
/**
 * One real disaster case, from published products only — 2023 Kahramanmaraş M7.8.
 *
 *   npm run data:quake
 *
 * Everything written here comes from a public service:
 *   - USGS event record (fdsnws)                     — magnitude, depth, MMI, alert
 *   - USGS aftershock catalogue (fdsnws, M>=3)       — counts, daily series, depths
 *   - USGS ShakeMap product set                      — intensity map, max MMI/PGA,
 *                                                      station list with measured MMI
 *   - NASA ASF Sentinel-1 GRD quicklooks             — real before/after radar imagery
 *
 * No figure is modelled by ORBIT. Where a product is unavailable the field is
 * written as null with a reason, and the UI says so.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/data/disaster';
const EVENT_ID = 'us6000jllz';
const EPI = { lat: 37.226, lon: 37.014 };
const UA = { 'User-Agent': 'ORBIT OS space-apps/1.0 (research; noraiopro@gmail.com)', Accept: 'application/json' };

async function j(url, headers = UA) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const ymd = (d) => d.toISOString().slice(0, 10);

async function main() {
  const fetchedAt = new Date().toISOString();

  // ---------------------------------------------------------------- event record
  const ev = await j(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${EVENT_ID}&format=geojson`);
  const p = ev.properties;
  const event = {
    id: EVENT_ID,
    title: p.title,
    magnitude: p.mag,
    magnitudeType: p.magType,
    time: new Date(p.time).toISOString(),
    place: p.place,
    depthKm: ev.geometry.coordinates[2],
    lat: ev.geometry.coordinates[1],
    lon: ev.geometry.coordinates[0],
    mmi: p.mmi,
    alert: p.alert,
    tsunami: p.tsunami,
    felt: p.felt,
    significance: p.sig,
    reviewStatus: p.status,
    url: p.url,
    source: 'USGS Earthquake Catalog (fdsnws)',
  };
  console.log(`event: M${event.magnitude} ${event.time} depth ${event.depthKm} km, MMI ${event.mmi}`);

  // ---------------------------------------------------------------- aftershocks
  const from = '2023-02-06';
  const to = '2023-04-30';
  const aq =
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3' +
    `&starttime=${from}&endtime=${to}&minlatitude=35.5&maxlatitude=38.8&minlongitude=35.0&maxlongitude=39.5`;
  const af = await j(aq);
  const feats = (af.features ?? []).filter((f) => f.properties.mag != null);
  const days = new Map();
  for (const f of feats) {
    const d = ymd(new Date(f.properties.time));
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  // 0.5-magnitude bins, so the published distribution is visible as it is
  const binMap = new Map();
  for (const f of feats) {
    const m = f.properties.mag;
    const k = (Math.floor(m * 2) / 2).toFixed(1);
    binMap.set(k, (binMap.get(k) ?? 0) + 1);
  }
  const bins = [...binMap.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([mag, count]) => ({ mag: Number(mag), count }));
  const strongest = [...feats].sort((a, b) => b.properties.mag - a.properties.mag)[0];
  const depths = feats.map((f) => f.geometry.coordinates[2]).filter((d) => typeof d === 'number');
  const aftershocks = {
    window: { from, to, minMagnitude: 3, bbox: [35.0, 35.5, 39.5, 38.8] },
    count: feats.length,
    counts: bins,
    byDay: [...days.entries()].sort().map(([date, n]) => ({ date, count: n })),
    strongest: strongest
      ? { magnitude: strongest.properties.mag, place: strongest.properties.place, time: new Date(strongest.properties.time).toISOString() }
      : null,
    meanDepthKm: depths.length ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : null,
    source: 'USGS aftershock catalogue (fdsnws), M≥3',
    url: aq,
  };
  console.log(`aftershocks: ${aftershocks.count} events, strongest M${aftershocks.strongest?.magnitude}`);

  // ---------------------------------------------------------------- shakemap
  const sm = await j(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${EVENT_ID}&format=geojson&producttype=shakemap`);
  const product = sm.properties?.products?.shakemap?.[0];
  let shakemap = { source: 'USGS ShakeMap', available: false };
  if (product) {
    const c = product.contents ?? {};
    const urlOf = (k) => c[k]?.url ?? null;
    let stations = null;
    const stationUrl = urlOf('download/stationlist.json');
    if (stationUrl) {
      try {
        const st = await j(stationUrl);
        const rows = st.features ?? [];
        const mmis = rows.map((r) => r.properties?.mmi).filter((v) => typeof v === 'number');
        const pgas = rows.map((r) => r.properties?.pga).filter((v) => typeof v === 'number');
        stations = {
          count: rows.length,
          mmiReadings: mmis.length,
          maxMmi: mmis.length ? Math.max(...mmis) : null,
          pgaReadings: pgas.length,
          maxPga: pgas.length ? Math.round(Math.max(...pgas) * 1000) / 1000 : null,
        };
      } catch (e) {
        stations = { error: String(e).slice(0, 80) };
      }
    }
    shakemap = {
      source: 'USGS ShakeMap (product ' + (product.code ?? EVENT_ID) + ')',
      available: true,
      mapStatus: product.properties?.['map-status'] ?? null,
      reviewStatus: product.properties?.['review-status'] ?? null,
      maxMmi: product.properties?.maxmmi ? Number(product.properties.maxmmi) : null,
      maxPga: product.properties?.maxpga ? Number(product.properties.maxpga) : null,
      intensityMap: urlOf('download/intensity.jpg'),
      pgaMap: urlOf('download/pga.jpg'),
      contours: urlOf('download/cont_mmi.json'),
      stations,
      url: product.properties?.url ?? null,
    };
    console.log(`shakemap: MMI ${shakemap.maxMmi}, stations ${stations?.count ?? 'n/a'}`);
  }

  // ------------------------------------------------------- Sentinel-1 quicklooks
  const asf = (extra) =>
    'https://api.daac.asf.alaska.edu/services/search/param?' +
    new URLSearchParams({
      platform: 'SENTINEL-1',
      processingLevel: 'GRD_HD',
      intersectsWith: `POINT(${EPI.lon} ${EPI.lat})`,
      output: 'json',
      maxResults: '40',
      ...extra,
    }).toString();

  const quick = (g) => {
    const b = g?.browse;
    if (typeof b === 'string' && b.startsWith('http')) return b;
    if (Array.isArray(b) && typeof b[0] === 'string') return b[0];
    return null;
  };

  let imagery = { available: false, source: 'NASA ASF Sentinel-1 GRD quicklooks' };
  try {
    const flat = (d) => (Array.isArray(d) && Array.isArray(d[0]) ? d[0] : Array.isArray(d) ? d : []);
    const before = await j(asf({ start: '2023-01-01T00:00:00Z', end: '2023-02-05T23:59:59Z' }));
    const after = await j(asf({ start: '2023-02-08T00:00:00Z', end: '2023-03-30T23:59:59Z' }));
    const rows = [...flat(before), ...flat(after)].filter((g) => quick(g) && g.startTime);
    for (const dir of ['ASCENDING', 'DESCENDING']) {
      const same = rows.filter((g) => (g.flightDirection ?? '') === dir).sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
      const b4 = same.filter((g) => g.startTime < '2023-02-06')[0];
      const af = same.filter((g) => g.startTime > '2023-02-06').pop();
      if (b4 && af) {
        imagery = {
          available: true,
          source: 'NASA ASF · Sentinel-1 GRD quicklook (browse image, no pixel values read)',
          pass: dir,
          before: { date: b4.startTime.slice(0, 10), time: b4.startTime.slice(11, 19), platform: b4.platform, image: quick(b4), granule: b4.granuleName },
          after: { date: af.startTime.slice(0, 10), time: af.startTime.slice(11, 19), platform: af.platform, image: quick(af), granule: af.granuleName },
        };
        break;
      }
    }
    console.log(`imagery: ${imagery.available ? `${imagery.pass} ${imagery.before.date} → ${imagery.after.date}` : 'no matched pair'}`);
  } catch (e) {
    imagery = { available: false, source: 'NASA ASF Sentinel-1 GRD quicklooks', error: String(e).slice(0, 120) };
  }

  const out = {
    domain: 'disaster-case',
    title: 'Kahramanmaraş M7.8 — one real case, from published products',
    generated_at: fetchedAt,
    event,
    aftershocks,
    shakemap,
    imagery,
    provenance: {
      providers: ['USGS Earthquake Hazards Program', 'USGS ShakeMap', 'NASA ASF'],
      access: 'keyless public APIs',
      honesty:
        'Event, aftershocks, ShakeMap intensity/PGA and the Sentinel-1 quicklooks are published products copied as-is. ORBIT computes only the aftershock counts, daily series, magnitude bins and mean depth from the catalogue rows. No deformation value is invented: InSAR displacement needs a processed SLC pair, which this build cannot authenticate.',
    },
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/kahramanmaras.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}/kahramanmaras.json`);
}

main().catch((e) => {
  console.error('quake build failed:', e.message);
  process.exit(1);
});
