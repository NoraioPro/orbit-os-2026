// Derives small browser-ready files from the ORBIT data collector harvest.
// Input : ../data-collector/out (or ORBIT_COLLECTOR_OUT / argv[2]); the collector itself is never modified.
// Output: public/data/live/*.json  (FIRMS is aggregated to 1° cells; POWER daily -> monthly means)
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || process.env.ORBIT_COLLECTOR_OUT || '../data-collector/out');
const outDir = path.resolve('public/data/live');
if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
  console.error(`No collector manifest at ${dir}. Run the data collector first, or pass its out/ path.`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const write = (f, o) => { fs.writeFileSync(path.join(outDir, f), JSON.stringify(o)); console.log(`  ${f}  ${(fs.statSync(path.join(outDir, f)).size / 1024).toFixed(0)} KB`); };
const manifest = read('manifest.json');
const collected = manifest.collected_at;
const oslo = new Date(collected).toLocaleString('en-GB', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const label = `live (harvested ${oslo} Oslo)`;
const fileOf = (id) => manifest.sources.find((s) => s.id === id)?.file;
console.log(`collector harvest ${collected} -> ${label}`);

// 1. Events: EONET + USGS in the same compact column format as the shard snapshot
const cols = ['id', 'type', 'title', 'lat', 'lon', 't', 'mag', 'unit', 'depth', 'link', 'src', 'url'];
const rows = [];
for (const id of ['eonet', 'usgs']) {
  const f = fileOf(id); if (!f) continue;
  for (const r of read(f).records) {
    if (r.lat == null || r.lon == null || !r.time) continue;
    const q = id === 'usgs';
    const t = Date.parse(r.time); if (!Number.isFinite(t)) continue;
    rows.push([r.id, q ? (r.type === 'earthquake' ? 'earthquake' : 'other') : r.type, r.title, +r.lat.toFixed(4), +r.lon.toFixed(4), t,
      q ? r.values.magnitude ?? null : r.values.magnitude ?? null, q ? r.values.magnitude_type ?? null : r.units?.magnitude ?? null,
      q ? (r.values.depth_km != null ? +r.values.depth_km.toFixed(1) : null) : null, null, id === 'usgs' ? 'USGS (M2.5+, 30 d)' : 'NASA EONET v3', r.url]);
  }
}
rows.sort((a, b) => b[5] - a[5]);
const byType = {}; for (const r of rows) byType[r[1]] = (byType[r[1]] ?? 0) + 1;
write('events.json', { meta: { snapshot_utc: collected, label, records: rows.length, shards: 0, by_type: byType, sources: ['NASA EONET v3 (open + 30 d + historical floods/storms/volcanoes/ice)', 'USGS M2.5+ past month'], notes: 'Harvested by orbit-os-data-collector. EONET wildfire rows are events (latest geometry), not detections; floods/storms/volcanoes/ice include full closed history since 2002.' }, cols, rows });

// 2. FIRMS: aggregate to 1° cells + hottest 400 detections
{
  const f = read(fileOf('firms'));
  const cells = new Map(); const sats = {}; const hot = [];
  for (const r of f.records) {
    if (r.lat == null || r.lon == null) continue;
    const k = `${Math.floor(r.lat)}|${Math.floor(r.lon)}`;
    const frp = Number(r.values.frp) || 0;
    const c = cells.get(k) ?? { lat: Math.floor(r.lat) + 0.5, lon: Math.floor(r.lon) + 0.5, n: 0, frp: 0, max: 0, night: 0 };
    c.n++; c.frp += frp; c.max = Math.max(c.max, frp); if (r.values.daynight === 'N') c.night++;
    cells.set(k, c);
    const s = r.values.satellite ?? r.values.feed ?? 'unknown'; sats[s] = (sats[s] ?? 0) + 1;
    if (hot.length < 400 || frp > hot[hot.length - 1][3]) { hot.push([+r.lat.toFixed(3), +r.lon.toFixed(3), r.time, frp, r.values.satellite ?? null, r.values.confidence ?? null]); hot.sort((a, b) => b[3] - a[3]); if (hot.length > 400) hot.pop(); }
  }
  const out = [...cells.values()].map((c) => [c.lat, c.lon, c.n, +c.frp.toFixed(1), +c.max.toFixed(1), c.night]);
  write('firms-grid.json', { label, retrieved_at: f.retrieved_at, time_range: f.time_range, detections: f.record_count, cell_deg: 1, cols: ['lat', 'lon', 'count', 'frp_sum_mw', 'frp_max_mw', 'night'], cells: out, hottest_cols: ['lat', 'lon', 'time', 'frp_mw', 'satellite', 'confidence'], hottest: hot, by_satellite: sats, notes: f.notes ?? [] });
}

// 3. NASA POWER daily -> monthly means per location (only months with >= 25 valid days)
{
  const f = read(fileOf('nasa-power'));
  const locs = {};
  for (const r of f.records) {
    const v = r.values; const id = v.location_id; const ym = r.time.slice(0, 7).replace('-', '');
    const L = (locs[id] ??= { id, name: v.location_name, region: v.region, lat: r.lat, lon: r.lon, url: r.url, acc: {}, daily: {} });
    for (const k of ['T2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN']) {
      if (v[k] == null) continue;
      const a = ((L.acc[k] ??= {})[ym] ??= [0, 0]); a[0] += v[k]; a[1]++;
    }
    L.last = r.time;
  }
  const out = Object.values(locs).map((L) => ({ id: L.id, name: L.name, region: L.region, lat: L.lat, lon: L.lon, url: L.url, last_day: L.last,
    monthly: Object.fromEntries(Object.entries(L.acc).map(([k, m]) => [k, Object.fromEntries(Object.entries(m).filter(([, [, n]]) => n >= 25).map(([ym, [s, n]]) => [ym, +(s / n).toFixed(3)]))])) }));
  write('power-monthly.json', { label, retrieved_at: f.retrieved_at, time_range: f.time_range, units: { T2M: '°C', PRECTOTCORR: 'mm/day', ALLSKY_SFC_SW_DWN: 'kWh/m²/day' }, notes: f.notes ?? [], locations: out });
}

// 4. Space weather + orbit: SWPC Kp & solar wind, DONKI CMEs, Celestrak sample
{
  const s = read(fileOf('swpc'));
  const kp = s.records.filter((r) => r.type === 'kp-index').map((r) => [r.time, r.values.kp]);
  const est = s.records.filter((r) => r.type === 'kp-index-estimated');
  const wind = s.records.filter((r) => r.type === 'solar-wind').map((r) => [r.time, r.values.speed ?? r.values.proton_speed ?? null, r.values.density ?? r.values.proton_density ?? null]);
  const imf = s.records.filter((r) => r.type === 'solar-wind-imf').map((r) => [r.time, r.values.bz_gsm ?? null, r.values.bt ?? null]);
  wind.sort((a, b) => String(a[0]).localeCompare(String(b[0]))); imf.sort((a, b) => String(a[0]).localeCompare(String(b[0]))); kp.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const d = read(fileOf('donki'));
  const cmes = d.records.map((r) => ({ id: r.id, time: r.time, speed: r.values.speed ?? null, half_angle: r.values.half_angle ?? null, type: r.values.cme_type ?? null, url: r.url, note: (r.values.note ?? '').slice(0, 220) }));
  const c = read(fileOf('celestrak'));
  const sats = c.records.map((r) => { const mm = r.values.mean_motion; const a = mm ? Math.cbrt(398600.4418 / (((mm * 2 * Math.PI) / 86400) ** 2)) : null; return { name: r.values.object_name, norad: r.values.norad_cat_id, epoch: r.values.epoch, inc: r.values.inclination, mm, alt_km: a ? Math.round(a - 6378.137) : null, ecc: r.values.eccentricity, reason: r.values.sample_reason }; });
  write('space.json', { label, swpc: { retrieved_at: s.retrieved_at, kp3h: kp, kp_latest_est: est.length ? [est[est.length - 1].time, est[est.length - 1].values.kp ?? est[est.length - 1].values.estimated_kp ?? null] : null, wind, imf, sample_keys: { wind: Object.keys(s.records.find((r) => r.type === 'solar-wind')?.values ?? {}), imf: Object.keys(s.records.find((r) => r.type === 'solar-wind-imf')?.values ?? {}) } },
    donki: { retrieved_at: d.retrieved_at, cmes, errors: manifest.sources.find((x) => x.id === 'donki')?.errors ?? [] },
    celestrak: { retrieved_at: c.retrieved_at, catalog_count: c.extra?.catalog_count ?? null, sample: sats } });
}

// 5. GIBS layer manifest (descriptors only)
{
  const g = read(fileOf('gibs'));
  write('gibs-layers.json', { label, retrieved_at: g.retrieved_at, capabilities_url: g.extra?.capabilities_url, layers: g.records.map((r) => ({ id: r.values.layer_id, title: r.title, theme: r.values.theme, format: r.values.format, tms: r.values.tile_matrix_set, max_level: +(String(r.values.tile_matrix_set).match(/Level(\d+)/)?.[1] ?? 6), default_time: r.values.default_time, template: r.values.wmts_template })) });
}

// 6. Manifest passthrough (provenance) with the display label
write('manifest.json', { ...manifest, output_dir: undefined, display_label: label });
