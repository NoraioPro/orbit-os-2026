// Builds public/data/events.json from the 86 ORBIT data shards (USGS ComCat + NASA EONET snapshot).
// Usage: node scripts/build-events.mjs [path/to/06_data-shards]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || path.resolve('../handoff/06_data-shards');
const files = fs.readdirSync(dir).filter((f) => /^shard-\d+\.json$/.test(f)).sort();
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const cols = ['id', 'type', 'title', 'lat', 'lon', 't', 'mag', 'unit', 'depth', 'link'];
const rows = [];
for (const f of files) {
  const { events } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const e of events) {
    const isQ = e.type === 'earthquake';
    rows.push([
      e.id,
      e.type,
      e.title,  // url is derived client-side from id (USGS event page / EONET API)
      +(+e.lat).toFixed(4),
      +(+e.lon).toFixed(4),
      e.epoch_ms,
      isQ ? (e.mag ?? null) : (e.magnitude_value ?? null),
      isQ ? (e.mag_type ?? null) : (e.magnitude_unit ?? null),
      isQ ? (e.depth_km ?? null) : null,
      Array.isArray(e.sources) && e.sources[0] ? e.sources[0].url : null,
    ]);
  }
}
rows.sort((a, b) => b[5] - a[5]);
const out = { meta: { ...meta, shard_files: files.length, built_utc: new Date().toISOString() }, cols, rows };
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/events.json', JSON.stringify(out));
console.log(`wrote ${rows.length} events from ${files.length} shards -> public/data/events.json`);
