import { cellFlags, confidenceFromP, fmt, haversineKm, type CellFlag, type DataStatus, type EvidencePack } from '../kernel';

export interface OrbitEvent {
  id: string; type: string; title: string; lat: number; lon: number; t: number;
  mag: number | null; unit: string | null; depth: number | null; link: string | null; url: string; source: string;
}
export interface EventsMeta { label?: string; snapshot_utc: string; records: number; shards: number; by_type: Record<string, number>; sources: string[]; notes: string }
export type EventSource = 'harvest' | 'shards';
export interface EventsDB { meta: EventsMeta; events: OrbitEvent[]; refTime: number; flags: CellFlag[]; source: EventSource; status: DataStatus; label: string }

export const TYPE_META: Record<string, { label: string; color: string; emoji: string }> = {
  earthquake: { label: 'Earthquake', color: '#f59e0b', emoji: '◉' },
  wildfires: { label: 'Wildfire detection', color: '#ef4444', emoji: '🔥' },
  severeStorms: { label: 'Severe storm', color: '#a78bfa', emoji: '🌀' },
  volcanoes: { label: 'Volcano', color: '#f97316', emoji: '🌋' },
  seaLakeIce: { label: 'Sea & lake ice', color: '#67e8f9', emoji: '❄' },
  floods: { label: 'Flood', color: '#3b82f6', emoji: '🌊' },
};

const urlFor = (id: string) =>
  id.startsWith('usgs_')
    ? `https://earthquake.usgs.gov/earthquakes/eventpage/${id.slice(5)}`
    : `https://eonet.gsfc.nasa.gov/api/v3/events/${id.split('_').slice(0, 2).join('_')}`;

const cache: Partial<Record<EventSource, Promise<EventsDB>>> = {};
let current: EventSource = 'harvest';
export const setEventSource = (s: EventSource) => { current = s; };
export const getEventSource = () => current;

/** Loads the collector harvest (default) or the 86-shard snapshot. Falls back to shards if the harvest is missing. */
export function loadEvents(source: EventSource = current): Promise<EventsDB> {
  if (!cache[source]) {
    const url = source === 'harvest' ? '/data/live/events.json' : '/data/events.json';
    cache[source] = fetch(url, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(`${url} HTTP ${r.status}`); return r.json(); })
      .then((j: { meta: EventsMeta; cols: string[]; rows: any[][] }) => {
        const harvest = source === 'harvest';
        const events: OrbitEvent[] = j.rows.map((r) => ({
          id: r[0], type: r[1], title: r[2], lat: r[3], lon: r[4], t: r[5], mag: r[6], unit: r[7], depth: r[8], link: r[9],
          url: harvest ? r[11] ?? urlFor(r[0]) : urlFor(r[0]),
          source: harvest ? r[10] : String(r[0]).startsWith('usgs_') ? 'USGS ComCat' : 'NASA EONET v3',
        }));
        const refTime = Date.parse(j.meta.snapshot_utc);
        const flags = cellFlags(events, refTime, { days: 7, cellDeg: 2, minRise: 5 });
        const label = harvest ? j.meta.label ?? 'live (harvested)' : `snapshot ${j.meta.snapshot_utc.slice(0, 16).replace('T', ' ')} UTC`;
        return { meta: j.meta, events, refTime, flags, source, status: (harvest ? 'live' : 'snapshot') as DataStatus, label };
      })
      .catch((e) => { delete cache[source]; if (source === 'harvest') { console.warn('Harvest unavailable, using shards', e); return loadEvents('shards'); } throw e; });
  }
  return cache[source]!;
}

export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const isoMin = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export function nearestPlaceName(db: EventsDB, lat: number, lon: number, type: string) {
  let best: OrbitEvent | null = null, bd = Infinity;
  for (const e of db.events) {
    if (e.type !== type) continue;
    const d = Math.abs(e.lat - lat) + Math.abs(e.lon - lon);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return `${lat.toFixed(0)}°, ${lon.toFixed(0)}°`;
  const t = best.title
    .replace(/^M\s?[\d.]+ - /, '')
    .replace(/^.*\bof\s+/, '')
    .replace(/^Wildfires? in\s+/i, '')
    .replace(/^Wildfire\s+/i, '')
    .replace(/\s+\d{5,}$/, '');
  return t.slice(0, 42);
}

export function eventsInCell(db: EventsDB, f: CellFlag, cellDeg = 2) {
  const la0 = f.lat - cellDeg / 2, lo0 = f.lon - cellDeg / 2;
  return db.events.filter((e) => e.type === f.type && e.lat >= la0 && e.lat < la0 + cellDeg && e.lon >= lo0 && e.lon < lo0 + cellDeg);
}

/** Evidence pack for a flagged 2° cell (Evidence & Anomaly Fabric). */
export function flagEvidence(db: EventsDB, f: CellFlag): EvidencePack {
  const DAY = 86400000;
  const inCell = eventsInCell(db, f).filter((e) => db.refTime - e.t <= 14 * DAY);
  const days = Array.from({ length: 14 }, (_, i) => {
    const end = db.refTime - (13 - i) * DAY;
    return { x: i - 13, y: inCell.filter((e) => e.t <= end && e.t > end - DAY).length };
  });
  const c = confidenceFromP(f.p);
  const tm = TYPE_META[f.type] ?? { label: f.type };
  const place = nearestPlaceName(db, f.lat, f.lon, f.type);
  return {
    id: `flag:${f.key}`,
    title: `${tm.label} surge · ${place}`,
    subtitle: `2° cell centred ${f.lat.toFixed(1)}°, ${f.lon.toFixed(1)}°`,
    kind: 'anomaly',
    status: db.status,
    statusLabel: db.label,
    sources: [
      { name: f.type === 'earthquake' ? (db.source === 'harvest' ? 'USGS M2.5+ past month (collector harvest)' : 'USGS ComCat (all_month feed)') : 'NASA EONET v3 events', url: f.type === 'earthquake' ? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php' : 'https://eonet.gsfc.nasa.gov/api/v3/events', retrieved: db.meta.snapshot_utc },
    ],
    window: { start: isoDay(db.refTime - 14 * DAY), end: isoDay(db.refTime), label: 'last 7 days vs previous 7 days' },
    location: { name: place, lat: f.lat, lon: f.lon, radiusKm: 111 },
    confidence: { ...c, rationale: `Poisson tail P(X≥${f.current} | λ=${Math.max(f.previous, 0.5)}) = ${f.p.toExponential(1)}. Counts only; detections are not independent fires/quakes, so treat as a lead for review.` },
    method: 'DG-04 fixed-window rule: flag when the 7-day count in a 2° cell at least doubles AND rises by ≥5 versus the previous 7 days. Statistical alert, not a forecast.',
    metrics: [
      { label: 'Last 7 days', value: String(f.current), status: db.status },
      { label: 'Previous 7 days', value: String(f.previous), status: db.status },
      { label: 'Ratio', value: Number.isFinite(f.ratio) ? `${fmt(f.ratio, 1)}×` : 'new (0 before)', status: db.status },
      { label: 'Records in cell (14 d)', value: String(inCell.length), status: db.status },
    ],
    series: { label: 'Daily count in cell', unit: 'events/day', points: days },
    records: inCell.slice(0, 25).map((e) => ({ id: e.id, title: e.title, time: isoMin(e.t), value: e.mag !== null ? `${e.mag}${e.unit ? ' ' + e.unit : ''}` : undefined, url: e.url })),
    limitations: [
      `${db.source === 'harvest' ? 'Harvested' : 'Snapshot taken'} ${db.meta.snapshot_utc} (UTC). Not refreshed automatically; re-run the collector to update.`,
      f.type === 'wildfires' ? (db.source === 'harvest' ? 'EONET wildfire rows are incident events (latest geometry date), not satellite detections; see FIRMS for detections.' : 'EONET wildfire rows are individual satellite/incident detections; one fire can produce many rows.') : 'USGS automatic solutions can be revised; small magnitudes are network-dependent.',
      'No forecast model is included. This is a count anomaly that needs human review.',
    ],
    patterns: ['anomaly', 'change', 'review'],
    createdAt: new Date().toISOString(),
  };
}

export function eventEvidence(db: EventsDB, e: OrbitEvent): EvidencePack {
  const DAY = 86400000;
  const near = db.events.filter((x) => x.type === e.type && x.id !== e.id && Math.abs(x.t - e.t) < 7 * DAY && haversineKm(x.lat, x.lon, e.lat, e.lon) < 200);
  const tm = TYPE_META[e.type] ?? { label: e.type };
  return {
    id: `event:${e.id}`,
    title: e.title,
    subtitle: tm.label,
    kind: 'event',
    status: db.status,
    statusLabel: db.label,
    sources: [{ name: e.source, url: e.url, retrieved: db.meta.snapshot_utc }, ...(e.link ? [{ name: 'Upstream source', url: e.link }] : [])],
    window: { start: isoMin(e.t), end: isoMin(e.t), label: 'event time (UTC)' },
    location: { name: `${e.lat.toFixed(3)}°, ${e.lon.toFixed(3)}°`, lat: e.lat, lon: e.lon },
    confidence: { level: e.source === 'USGS ComCat' ? 'high' : 'medium', score: e.source === 'USGS ComCat' ? 0.85 : 0.65, rationale: 'Catalogued by the source agency. Location/magnitude may be revised.' },
    method: db.source === 'harvest' ? 'Single source record from the ORBIT data-collector harvest.' : 'Single source record as stored in the ORBIT shard snapshot.',
    metrics: [
      ...(e.mag !== null ? [{ label: 'Magnitude', value: `${e.mag} ${e.unit ?? ''}`, status: db.status }] : []),
      ...(e.depth !== null ? [{ label: 'Depth', value: `${e.depth} km`, status: db.status }] : []),
      { label: 'Same-type events ≤200 km, ±7 d', value: String(near.length), status: db.status },
    ],
    records: near.slice(0, 15).map((x) => ({ id: x.id, title: x.title, time: isoMin(x.t), url: x.url })),
    limitations: [`${db.label}. Open the source link for the latest revision.`],
    patterns: ['anomaly', 'review'],
    createdAt: new Date().toISOString(),
  };
}
