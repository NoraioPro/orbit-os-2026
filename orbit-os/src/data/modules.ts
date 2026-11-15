import type { PatternId } from '../kernel';

export interface Challenge { n: number; name: string; file: string }
export const CHALLENGES: Challenge[] = [
  { n: 1, name: 'Retired Hardware Story', file: 'solution-01-retired-hardware-story.html' },
  { n: 2, name: 'Earth System Trend Detective', file: 'solution-02-trend-detective.html' },
  { n: 3, name: 'Mars Outpost Trainer', file: 'solution-03-outpost-trainer.html' },
  { n: 4, name: 'Astronaut Health Monitor', file: 'solution-04-astronaut-health.html' },
  { n: 5, name: 'Radar Surface Change', file: 'solution-05-radar-change.html' },
  { n: 6, name: 'Field Shift Rotation Planner', file: 'solution-06-farm-rotation.html' },
  { n: 7, name: 'Microgravity Fire Dashboard (ISS)', file: 'solution-07-fire-dashboard.html' },
  { n: 8, name: 'Fire Calendar Harmonizer', file: 'solution-08-fire-calendar.html' },
  { n: 9, name: 'Earth Analog Ranker', file: 'solution-09-analog-sites.html' },
  { n: 10, name: 'Martian Route Map', file: 'solution-10-mars-map.html' },
  { n: 11, name: 'Lunar Site Navigator', file: 'solution-11-landing-navigator.html' },
  { n: 12, name: 'Sky Change Viewer', file: 'solution-12-sky-changes.html' },
  { n: 13, name: 'Mission Design Game', file: 'solution-13-mission-design.html' },
  { n: 14, name: 'Earth Sound Jukebox', file: 'solution-14-earth-jukebox.html' },
];

export type ModuleId = 'earth' | 'disaster' | 'agri' | 'ocean' | 'infrastructure' | 'gnss' | 'explorer' | 'academy' | 'human' | 'sar' | 'defense';
export interface OrbitModule {
  id: ModuleId; name: string; icon: string; tagline: string; release: 'P0' | 'P1' | 'P2' | 'P3';
  state: 'demo' | 'concept'; challenges: number[]; patterns: PatternId[]; datasets: string[]; sdgs: number[];
  gradient: string; question: string; honest: string;
}

export const MODULES: OrbitModule[] = [
  { id: 'earth', name: 'Earth Intelligence', icon: 'Globe2', tagline: 'ORBIT Earth Pulse: the lead module. Is this place changing, and how sure are we?', release: 'P0', state: 'demo', challenges: [2, 5, 6, 8, 14], patterns: ['change', 'anomaly', 'fusion', 'review', 'predict'], datasets: ['power', 'eonet', 'firms', 'gibs', 'gistemp', 'gpm', 'smap', 'modis', 'hls', 'nisar'], sdgs: [13, 15, 2], gradient: 'from-sky-500/40 via-blue-700/30 to-emerald-500/30', question: 'Show temperature change in Norway last 20 years', honest: 'NASA POWER trends (live, harvested, or 2001–2025 snapshot), FIRMS fires and GIBS imagery from the collector harvest. GISTEMP, SMAP, MODIS NDVI values, HLS and NISAR are planned and labelled "not connected". GIBS NDVI is shown as imagery only.' },
  { id: 'disaster', name: 'Disaster Watch', icon: 'Flame', tagline: 'Count anomalies across 14k quake and natural-event records, each one opening an evidence pack.', release: 'P1', state: 'demo', challenges: [8, 2], patterns: ['anomaly', 'change', 'review'], datasets: ['usgs', 'eonet', 'firms', 'shards'], sdgs: [11, 13], gradient: 'from-orange-500/50 via-red-700/30 to-rose-900/30', question: 'Any unusual wildfire activity in the last 7 days?', honest: 'Collector harvest (14 Nov 2026 14:06 Oslo) by default; the 86-shard snapshot is selectable in Settings. Flags are statistical alerts, not warnings.' },
  { id: 'agri', name: 'Agri Intelligence', icon: 'Sprout', tagline: 'Soil-wetness and rainfall stress plus rotation planning on a limited water budget.', release: 'P1', state: 'demo', challenges: [6, 2], patterns: ['change', 'planning', 'fusion'], datasets: ['power', 'smap', 'modis', 'gpm', 'hls'], sdgs: [2, 15], gradient: 'from-lime-500/40 via-green-700/30 to-emerald-900/30', question: 'Is soil getting drier in the Sahel since 2005?', honest: 'Real POWER GWETROOT/precipitation. The field plan uses sample fields and costs.' },
  { id: 'ocean', name: 'Ocean Intelligence', icon: 'Waves', tagline: 'Marine air temperature trends and sea-ice events. SST/ocean colour are planned.', release: 'P1', state: 'demo', challenges: [2, 14], patterns: ['change', 'anomaly'], datasets: ['power', 'eonet'], sdgs: [14, 13], gradient: 'from-cyan-500/40 via-blue-800/30 to-indigo-900/30', question: 'Show temperature change in the North Atlantic since 2001', honest: 'POWER T2M over ocean is marine AIR temperature, not SST. Ocean colour (PACE/MODIS) is not connected.' },
  { id: 'infrastructure', name: 'Infrastructure', icon: 'Building2', tagline: 'Ground stability: radar change detection plus seismic exposure near assets.', release: 'P2', state: 'demo', challenges: [5], patterns: ['change', 'anomaly', 'fusion', 'review'], datasets: ['nisar', 'usgs', 'hls'], sdgs: [11, 9], gradient: 'from-blue-500/40 via-indigo-700/30 to-slate-900/30', question: 'How many earthquakes near Tokyo in the last 30 days?', honest: 'The deformation grid is SAMPLE data (challenge 5 prototype). Seismic counts are snapshot or live USGS.' },
  { id: 'gnss', name: 'GNSS Guardian', icon: 'Satellite', tagline: 'Know when navigation cannot be trusted — parse real GnssLogger recordings and assess signal integrity.', release: 'P2', state: 'demo', challenges: [], patterns: ['anomaly', 'fusion', 'review'], datasets: ['swpc', 'celestrak'], sdgs: [9, 16], gradient: 'from-violet-500/40 via-indigo-700/30 to-slate-900/30', question: 'Detect GNSS interference near Andøya', honest: 'Uploads real Google GnssLogger / NMEA recordings and runs a deterministic integrity engine — with no recording loaded the board stays empty rather than showing a synthetic trace. NOAA SWPC space weather is broader context, never evidence of spoofing. No output claims certified navigation safety.' },
  { id: 'explorer', name: 'Space Explorer', icon: 'Orbit', tagline: 'Earth analog to Moon/Mars transfer: rank Earth sites, then reuse the Earth-tested pipeline off-world.', release: 'P2', state: 'demo', challenges: [9, 11, 12, 10], patterns: ['transfer', 'change', 'anomaly'], datasets: ['power', 'swpc', 'donki', 'celestrak'], sdgs: [9, 4], gradient: 'from-indigo-500/40 via-violet-700/30 to-purple-950/30', question: 'Which Earth site is the best Mars analog?', honest: 'Earth climate is real POWER snapshot data. Mars and Moon profiles are approximate reference values (sample).' },
  { id: 'academy', name: 'Mission Academy', icon: 'Gamepad2', tagline: 'Learn by designing missions under mass, power and budget limits.', release: 'P2', state: 'demo', challenges: [13, 3, 1], patterns: ['planning', 'transfer'], datasets: [], sdgs: [4], gradient: 'from-amber-400/50 via-yellow-700/30 to-stone-900/30', question: 'Design a Mars outpost with 1000 kg', honest: 'Educational SAMPLE values. Not engineering data.' },
  { id: 'human', name: 'Human Space Lab', icon: 'HeartPulse', tagline: 'Suit engineering and ISS combustion science: open the EVA suit, then read the microgravity fire data.', release: 'P3', state: 'concept', challenges: [4, 7], patterns: ['anomaly', 'review'], datasets: [], sdgs: [3], gradient: 'from-slate-300/30 via-slate-600/30 to-slate-900/30', question: 'Open up the NORGE EVA suit and see how it is built', honest: 'The EVA suit is an interactive NORGE build-lab model — a design and education artifact, not a certified or pressure-tested suit; its own safety note says so and it is a conceptual mock-up. No medical telemetry or flight-safety claim is made anywhere in this module. Challenge 7 (ISS microgravity combustion) is real published Saffire/LUCI data in IGNIS and is NOT merged with Earth wildfire data.' },
  { id: 'sar', name: 'SAR Earth Observatory', icon: 'Radio', tagline: 'See the invisible: radar reveals surface change that optical imagery misses.', release: 'P0', state: 'demo', challenges: [5], patterns: ['change', 'anomaly', 'fusion', 'review'], datasets: ['nisar', 'hls'], sdgs: [13, 15, 11], gradient: 'from-teal-500/40 via-emerald-700/30 to-slate-900/30', question: 'What changed between two radar passes over this region?', honest: 'Backscatter change, InSAR displacement and coherence over analysis-ready rasters (SAMPLE in the interactive demo). Real NISAR/Sentinel-1 discovery runs through the ASF connector; downloads need an Earthdata login. Raw SLC interferometry is not performed in-browser.' },
  { id: 'defense', name: 'Defense & Crisis', icon: 'Target', tagline: 'Live Earth situation room: every satellite, every crisis, every sensor — one real-time picture.', release: 'P1', state: 'demo', challenges: [], patterns: ['anomaly', 'fusion', 'review'], datasets: ['usgs', 'eonet', 'firms', 'swpc', 'celestrak', 'norge'], sdgs: [16, 9], gradient: 'from-rose-500/40 via-red-700/30 to-slate-900/30', question: 'What is happening on Earth right now?', honest: 'Satellite positions are approximate Keplerian propagation of CelesTrak TLEs (no J2/drag). Events, fires and space weather are real USGS / NASA EONET / FIRMS / NOAA SWPC harvests. A situational-awareness view, not a warning or defense-grading system.' },
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id);

export const SDGS: Record<number, { name: string; color: string }> = {
  2: { name: 'Zero Hunger', color: '#DDA63A' },
  3: { name: 'Good Health', color: '#4C9F38' },
  4: { name: 'Quality Education', color: '#C5192D' },
  9: { name: 'Industry & Innovation', color: '#FD6925' },
  11: { name: 'Sustainable Cities', color: '#FD9D24' },
  13: { name: 'Climate Action', color: '#3F7E44' },
  14: { name: 'Life Below Water', color: '#0A97D9' },
  15: { name: 'Life on Land', color: '#56C02B' },
  16: { name: 'Peace & Institutions', color: '#00689D' },
};

export const AGENTS = [
  { id: 'planner', name: 'Planner agent', pattern: 'review' as const, does: 'Turns a question into a structured plan (deterministic parser; optional LLM via ORBIT_LLM_API_KEY).' },
  { id: 'change', name: 'Change agent', pattern: 'change' as const, does: 'Theil-Sen + Mann-Kendall trend and window-vs-baseline change.' },
  { id: 'anomaly', name: 'Anomaly agent', pattern: 'anomaly' as const, does: 'DG-04 cell flags, Poisson tail test, z-score outliers.' },
  { id: 'fusion', name: 'Fusion agent', pattern: 'fusion' as const, does: 'Weights independent indicators into one confidence.' },
  { id: 'planning', name: 'Resource agent', pattern: 'planning' as const, does: 'Budgeted allocation and energy-limited routing.' },
  { id: 'transfer', name: 'Transfer agent', pattern: 'transfer' as const, does: 'Scores Earth analogs against Moon/Mars profiles.' },
  { id: 'forecast', name: 'Forecast agent', pattern: 'predict' as const, does: 'Seasonal-trend extrapolation and event-rate early warning. Statistical only — never an official alert.' },
];
