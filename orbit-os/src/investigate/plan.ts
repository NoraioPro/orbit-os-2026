import { PLACES, type Place } from '../data/power';
import type { ModuleId } from '../data/modules';

export type Intent = 'trend' | 'events' | 'anomaly' | 'analog' | 'unsupported';
export interface PlanStep { label: string; detail: string; status: 'pending' | 'done' | 'planned' | 'skipped' | 'failed' }
export interface InvestigationPlan {
  question: string; intent: Intent; sector: ModuleId; variables: string[]; eventType?: string;
  place: { name: string; lat: number; lon: number; id?: string; radiusKm: number } | null;
  yearFrom: number; yearTo: number; recentYears: number; days: number;
  datasets: string[]; notes: string[]; planner: 'deterministic' | 'llm'; steps: PlanStep[];
}

const LAST_FULL_YEAR = 2025; // NASA POWER monthly is complete through the previous calendar year

function findPlace(q: string): Place | null {
  const s = q.toLowerCase();
  let best: Place | null = null, len = 0;
  for (const p of PLACES) for (const a of p.aliases) {
    const re = new RegExp(`(^|[^a-zæøå])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zæøå]|$)`);
    if (re.test(s) && a.length > len) { best = p; len = a.length; }
  }
  return best;
}

export function deterministicPlan(question: string): InvestigationPlan {
  const q = question.toLowerCase();
  const notes: string[] = [];
  const has = (...w: string[]) => w.some((x) => q.includes(x));

  // place
  let place: InvestigationPlan['place'] = null;
  const coord = q.match(/(-?\d{1,2}(?:\.\d+)?)\s*[°,]?\s*([ns])?\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([ew])?/);
  const p = findPlace(q);
  if (p) place = { name: p.name, lat: p.lat, lon: p.lon, id: p.id, radiusKm: 500 };
  else if (coord && /\d+\.\d+|°|[ns]\b/.test(coord[0])) {
    let lat = +coord[1], lon = +coord[3];
    if (coord[2] === 's') lat = -Math.abs(lat);
    if (coord[4] === 'w') lon = -Math.abs(lon);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) place = { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon, radiusKm: 500 };
  }

  // time
  let recentYears = 5, days = 30;
  const lastN = q.match(/(?:last|past|previous)\s+(\d+)\s*(year|yr|month|week|day)/);
  const since = q.match(/since\s+(\d{4})/);
  const range = q.match(/(\d{4})\s*[-–to]+\s*(\d{4})/);
  let yearFrom = 2001, yearTo = LAST_FULL_YEAR;
  if (lastN) {
    const n = +lastN[1];
    if (lastN[2].startsWith('y')) recentYears = n;
    else if (lastN[2] === 'month') days = n * 30;
    else if (lastN[2] === 'week') days = n * 7;
    else days = n;
  }
  if (since) { yearFrom = Math.max(1981, +since[1]); recentYears = Math.max(1, Math.floor((LAST_FULL_YEAR - yearFrom + 1) / 2)); }
  if (range) { yearFrom = Math.max(1981, +range[1]); yearTo = Math.min(LAST_FULL_YEAR, +range[2]); }
  if (lastN?.[2].startsWith('y')) yearFrom = Math.min(2001, LAST_FULL_YEAR - recentYears * 2 + 1);
  if (yearTo - yearFrom < 9) { notes.push('Trend fit widened to ≥10 years for statistical power; the requested window is compared against the earlier baseline.'); yearFrom = yearTo - 9; }

  // intent and variables
  let intent: Intent = 'trend', sector: ModuleId = 'earth', variables: string[] = ['T2M'], eventType: string | undefined;
  const datasets: string[] = [];
  if (has('mars', 'moon', 'lunar', 'analog', 'analogue')) { intent = 'analog'; sector = 'explorer'; variables = ['T2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN']; datasets.push('power'); }
  else if (has('earthquake', 'quake', 'seismic', 'tremor')) { intent = 'events'; eventType = 'earthquake'; sector = has('infrastructure', 'bridge', 'building') ? 'infrastructure' : 'disaster'; datasets.push('shards', 'usgs'); }
  else if (has('wildfire', 'fire', 'burn')) { intent = has('unusual', 'anomal', 'spike', 'surge') ? 'anomaly' : 'events'; eventType = 'wildfires'; sector = 'disaster'; datasets.push('shards', 'eonet', 'firms'); notes.push('NASA FIRMS 24 h detections come from the collector harvest (1° cells); EONET wildfire events are used for the 7-day comparison.'); }
  else if (has('storm', 'hurricane', 'typhoon', 'cyclone')) { intent = 'events'; eventType = 'severeStorms'; sector = 'disaster'; datasets.push('shards', 'eonet'); }
  else if (has('volcan', 'eruption')) { intent = 'events'; eventType = 'volcanoes'; sector = 'disaster'; datasets.push('shards', 'eonet'); }
  else if (has('iceberg', 'sea ice', 'lake ice')) { intent = 'events'; eventType = 'seaLakeIce'; sector = 'ocean'; datasets.push('shards', 'eonet'); }
  else if (has('unusual', 'anomal', 'spike', 'surge', 'hotspot')) { intent = 'anomaly'; sector = 'disaster'; datasets.push('shards'); }
  else if (has('gnss', 'gps', 'jamming', 'spoof')) { intent = 'unsupported'; sector = 'gnss'; notes.push('No GNSS feed is connected. Open GNSS Guardian for the sample-data demo.'); }
  else {
    datasets.push('power');
    if (has('vegetation', 'ndvi', 'green', 'crop', 'farm', 'agri', 'harvest')) {
      variables = ['GWETROOT', 'T2M', 'PRECTOTCORR']; sector = has('vegetation', 'ndvi', 'green') ? 'earth' : 'agri';
      notes.push('No NDVI values are connected (GIBS NDVI is imagery only; switch the globe to a GIBS NDVI layer to look). ORBIT does not show an NDVI number. It fuses the measured growth drivers instead: soil wetness, temperature and precipitation.');
      datasets.push('modis', 'smap');
    } else if (has('drought', 'soil', 'moisture', 'dry')) { variables = ['GWETROOT', 'PRECTOTCORR']; sector = 'agri'; datasets.push('smap'); notes.push('SMAP not connected; using POWER root-zone soil wetness (MERRA-2) as a proxy.'); }
    else if (has('rain', 'precip', 'flood', 'monsoon', 'wet')) { variables = ['PRECTOTCORR']; datasets.push('gpm'); }
    else if (has('solar', 'sun', 'radiation', 'cloud')) variables = ['ALLSKY_SFC_SW_DWN'];
    else if (has('ocean', 'sea', 'sst', 'marine', 'atlantic', 'fish')) { variables = ['T2M']; sector = 'ocean'; notes.push('SST is not connected; POWER T2M over ocean is marine air temperature.'); }
    else if (has('temperature', 'warming', 'heat', 'climate', 'warm', 'cold', 'ice', 'snow')) { variables = ['T2M']; datasets.push('gistemp'); }
    else notes.push('No variable keyword found; defaulting to 2 m air temperature.');
    if (place && place.id && ['atlantic', 'mediterranean'].includes(place.id) && variables[0] === 'GWETROOT') { variables = ['T2M', 'PRECTOTCORR']; notes.push('Soil wetness is undefined over ocean.'); }
  }
  if (!place && (intent === 'trend')) { const o = PLACES[0]; place = { name: o.name, lat: o.lat, lon: o.lon, id: o.id, radiusKm: 500 }; notes.push('No location recognised; defaulting to Oslo. Name a place or give "lat, lon".'); }
  if (intent === 'events' || intent === 'anomaly') days = Math.min(days, 30);

  return { question, intent, sector, variables, eventType, place, yearFrom, yearTo, recentYears, days, datasets: [...new Set(datasets)], notes, planner: 'deterministic', steps: buildSteps(intent) };
}

export function buildSteps(intent: Intent): PlanStep[] {
  const s = (label: string, detail: string): PlanStep => ({ label, detail, status: 'pending' });
  const common = [s('Resolve area of interest', 'Gazetteer or lat/lon → point + radius'), s('Select datasets', 'Pick connectors and record each one\'s status')];
  if (intent === 'trend') return [...common, s('Fetch observations', 'NASA POWER live → bundled snapshot fallback'), s('Change engine', 'Annual means · Theil-Sen · Mann-Kendall · window vs baseline'), s('Anomaly + fusion', 'Outlier years; fuse multiple indicators'), s('Evidence pack', 'Source, window, confidence, status'), s('Human review', 'Queued as pending')];
  if (intent === 'events') return [...common, s('Query snapshot', 'ORBIT shards: radius + time window'), s('Live cross-check', 'USGS FDSN count / EONET open events'), s('Anomaly engine', 'DG-04 cell flags within AOI'), s('Evidence pack', 'Records, counts, sources'), s('Human review', 'Queued as pending')];
  if (intent === 'anomaly') return [...common, s('Anomaly engine', 'DG-04: 7 d vs previous 7 d per 2° cell'), s('Rank flags', 'Poisson tail p-value → confidence'), s('Evidence pack', 'Top flags with records'), s('Human review', 'Queued as pending')];
  if (intent === 'analog') return [...common, s('Fetch Earth climate', 'POWER snapshot for analog sites'), s('Transfer engine', 'Similarity to the Mars/Moon profile'), s('Evidence pack', 'Ranked sites + caveats'), s('Human review', 'Queued as pending')];
  return [...common, s('Check coverage', 'Is a connector available?')];
}
