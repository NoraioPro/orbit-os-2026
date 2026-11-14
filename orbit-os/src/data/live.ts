// Keyless live connectors. Each returns status 'live' only when the network call succeeded.
export async function fetchJson(url: string, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function usgsCount(opts: { lat: number; lon: number; radiusKm: number; start: string; end: string; minMag?: number }) {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&latitude=${opts.lat}&longitude=${opts.lon}&maxradiuskm=${opts.radiusKm}&starttime=${opts.start}&endtime=${opts.end}${opts.minMag !== undefined ? `&minmagnitude=${opts.minMag}` : ''}`;
  const j = await fetchJson(url);
  return { count: j.count as number, url };
}

export async function eonetEvents(opts: { category?: string; days?: number; bbox?: [number, number, number, number]; status?: 'open' | 'all' }) {
  const p = new URLSearchParams({ status: opts.status ?? 'open', days: String(opts.days ?? 30), limit: '500' });
  if (opts.category) p.set('category', opts.category);
  if (opts.bbox) p.set('bbox', opts.bbox.join(','));
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?${p}`;
  const j = await fetchJson(url);
  return { events: j.events as any[], url };
}

/** Lightweight reachability ping used by the Live badge. */
export async function pingLive(): Promise<boolean> {
  try { await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/categories', 6000); return true; } catch { return false; }
}
