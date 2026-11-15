import type { TourStep } from '../components/GuidedTour';

const s = (selector: string, title: string, text: string): TourStep => ({ selector, title, text });

/** Guided-tour steps per module. Selectors target [data-tour="…"] anchors in ModulePage. */
export const TOURS: Record<string, TourStep[]> = {
  earth: [
    s('[data-tour="hero"]', 'Earth Intelligence — the lead module', 'This is the flagship: ORBIT Earth Pulse. It asks one question about any place on Earth — is it changing, and how sure are we?'),
    s('[data-tour="live"]', 'Live eyes on Earth right now', 'Live weather from MET Norway for the module\u2019s own coordinates. This is not a static demo — it\u2019s today.'),
    s('[data-tour="honesty"]', 'Data honesty first', 'Every number is labeled live, snapshot or sample. What\u2019s not connected is said out loud — GISTEMP, SMAP and NISAR are marked "not connected", never faked.'),
    s('[data-tour="main"]', 'The trend detective in action', 'Pick a place and a climate variable. You\u2019ll see the slope, its statistical significance, and a 10-year forecast with a widening confidence band.'),
    s('[data-tour="sources"]', 'Provenance & challenges', 'Kernel patterns, the datasets behind each figure, and the five NASA Space Apps challenges this one module answers.'),
  ],
  disaster: [
    s('[data-tour="hero"]', 'Disaster Watch', 'Quakes, fires, floods, storms, volcanoes and ice — 14,000 real events, each one opening an evidence pack instead of a siren.'),
    s('[data-tour="honesty"]', 'Statistical alerts, not warnings', 'Flags are a fixed-window count rule, not a forecast. The provenance note tells you exactly what you\u2019re looking at.'),
    s('[data-tour="guide"]', 'How to use it', 'Filter by event type, click any flag for its evidence, or hit Run demo for a worked anomaly in one click.'),
    s('[data-tour="main"]', 'The anomaly fabric', 'A 2° grid flags any cell where the last 7 days doubled the previous 7. Click a row to open the full evidence pack.'),
    s('[data-tour="sources"]', 'Data & challenges', 'NASA EONET, USGS and FIRMS feed it. It answers the Fire Calendar Harmonizer and Trend Detective challenges.'),
  ],
  agri: [
    s('[data-tour="hero"]', 'Agri Intelligence', 'Soil wetness, rainfall stress and crop rotations on a limited water budget — built for the Field Shift challenge.'),
    s('[data-tour="live"]', 'Live weather at the field', 'Real MET Norway conditions for the Sahel, plus NASA POWER soil wetness behind the scenes.'),
    s('[data-tour="main"]', 'Crop-stress drivers', 'Soil wetness (a SMAP proxy from POWER) and rainfall show where crops are under stress — and the water-budget planner turns that into a rotation plan.'),
    s('[data-tour="sources"]', 'Sources & honesty', 'Real POWER GWETROOT and precipitation; the field plan itself is clearly labeled sample.'),
  ],
  ocean: [
    s('[data-tour="hero"]', 'Ocean Intelligence', 'Marine air-temperature trends and sea-ice events — the ocean side of the change engine.'),
    s('[data-tour="live"]', 'Live North Atlantic weather', 'Real MET Norway conditions over the ocean right now.'),
    s('[data-tour="main"]', 'Temperature trend & icebergs', 'Marine air temperature trend (not SST — labeled honestly) plus tracked sea-ice events.'),
    s('[data-tour="sources"]', 'Sources', 'NASA POWER over-ocean temperature and EONET sea/lake ice. Ocean colour (PACE/MODIS) is marked not connected.'),
  ],
  infrastructure: [
    s('[data-tour="hero"]', 'Infrastructure', 'Ground stability — radar surface-change detection and seismic exposure near critical assets.'),
    s('[data-tour="main"]', 'Radar change + seismic exposure', 'A line-of-sight displacement grid (sample) and real USGS quakes within 300 km of major cities.'),
    s('[data-tour="sources"]', 'Honest scope', 'The deformation grid is sample (NISAR not connected); seismic counts are real USGS. Exposure is not risk.'),
  ],
  gnss: [
    s('[data-tour="hero"]', 'GNSS Guardian', 'Know when navigation cannot be trusted — signal integrity from the Norwegian Space Cluster\u2019s Arctic Intel Watch.'),
    s('[data-tour="main"]', 'Mission control', 'Constellation view, live signal monitor, spoofing/jamming assessment, a simulation lab and an evidence trail.'),
    s('[data-tour="sources"]', 'Safety & honesty', 'It never claims certified navigation safety and never generates real interference — it analyzes recorded signals.'),
  ],
  sar: [
    s('[data-tour="hero"]', 'SAR Earth Observatory', 'Dancing with the SARs — see the invisible. NISAR and Sentinel-1 radar reveal surface change optical cameras miss.'),
    s('[data-tour="main"]', 'Before / after + InSAR', 'Backscatter change and phase-to-displacement labs, with a live NISAR/Sentinel-1 acquisition catalogue from ASF.'),
    s('[data-tour="sources"]', 'Single line-of-sight honesty', 'One look direction is not 3-D motion — visual change is not physical cause. Cross-link evidence is required.'),
  ],
  autonomy: [
    s('[data-tour="hero"]', 'Autonomy Lab', 'The same A* route planner runs on Mars and on an Earth analog — that transfer is the whole point.'),
    s('[data-tour="main"]', 'Energy-limited routing', 'Toggle Mars rover vs Svalbard drone and watch the planner route around obstacles at minimum energy cost.'),
    s('[data-tour="sources"]', 'Honest terrain', 'The terrain-cost grids are synthetic (clearly labeled); the kernel is the real deliverable.'),
  ],
  explorer: [
    s('[data-tour="hero"]', 'Space Explorer', 'Rank Earth sites by how well they resemble the Moon and Mars — then scout lunar landing sites.'),
    s('[data-tour="main"]', 'Analog ranker + lunar navigator', 'Real NASA POWER climate means scored against reference world profiles, plus lunar south-pole sites with visibility rationale.'),
    s('[data-tour="sources"]', 'Live vs sample', 'Earth columns are real POWER data; the Mars/Moon reference profiles and visibility numbers are sample.'),
  ],
  academy: [
    s('[data-tour="hero"]', 'Mission Academy', 'Retired hardware stories, an outpost life-support trainer, and a mission design game.'),
    s('[data-tour="main"]', 'Design & train', 'Balance power, water and food on a mass budget — educational numbers, clearly labeled sample.'),
    s('[data-tour="sources"]', 'Educational honesty', 'Masses and value scores are for learning, not engineering.'),
  ],
  human: [
    s('[data-tour="hero"]', 'Human Space Lab', 'Astronaut health monitoring and microgravity combustion — kept deliberately separate from Earth fire data.'),
    s('[data-tour="main"]', 'Health trace + combustion', 'A sample physiological trace with z-score anomaly detection, and an explainer on how fire behaves without buoyancy.'),
    s('[data-tour="sources"]', 'No medical claims', 'The kernel never diagnoses — anomalies are queued for a flight surgeon\u2019s review. Sample data, stated plainly.'),
  ],
  ignis: [
    s('[data-tour="hero"]', 'IGNIS · Flame in Freefall', 'Real microgravity combustion data — published Saffire-I/II and LUCI flame-spread measurements, 19 NASA PSI investigation profiles and 5 curated collections.'),
    s('[data-tour="main"]', 'The real data', 'Flame spreads slower without buoyancy-driven airflow: 0.92\u20132.1 mm/s in microgravity vs 1.5 mm/s at 1-g. Every figure traces to an NTRS citation.'),
    s('[data-tour="sources"]', 'Kept separate by design', 'Microgravity combustion is not merged with Earth wildfire data — different physics, different signatures. Row-level provenance for every figure.'),
  ],
  defense: [
    s('[data-tour="hero"]', 'Earth Situation Room', 'A real-time picture of Earth for situational awareness — the live satellite population, active crises, and every free sensor feeding it.'),
    s('[data-tour="main"]', 'The satellite swarm', 'Every active satellite orbiting Earth, propagated in real time from CelesTrak TLEs. Filter by LEO, MEO, GEO or Starlink, and hover any point for its orbit.'),
    s('[data-tour="honesty"]', 'What is real vs approximate', 'Satellite positions are approximate Keplerian propagation. Events, fires and space weather are real harvests — and this is a situational view, not a warning system.'),
    s('[data-tour="sources"]', 'Free data sources', 'Twelve keyless sources power it: CelesTrak, USGS, NASA EONET/FIRMS/POWER/GIBS/DONKI, NOAA SWPC, MET Norway, Open-Meteo and ASF.'),
  ],
};
