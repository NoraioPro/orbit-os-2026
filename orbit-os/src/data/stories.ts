import type { DataStatus } from '../kernel';

export interface StoryBeat {
  id: string;
  lat: number;
  lng: number;
  title: string;
  text: string;
  status: DataStatus;
  source: string;
  next?: string;
}

export interface ModuleStory {
  intro: string;
  beats: StoryBeat[];
}

export const STORIES: Record<string, ModuleStory> = {
  earth: {
    intro: 'One change engine: is this place changing, and how sure are we?',
    beats: [
      { id: 'norway', lat: 61.5, lng: 9.0, title: 'Norway temperature', text: '+0.26 °C/decade over 25 years of NASA POWER. A modest but real warming signal, tested with Mann-Kendall.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'GISTEMP regional anomaly baseline' },
      { id: 'svalbard', lat: 78.22, lng: 15.65, title: 'Svalbard warming', text: '+0.67 °C/decade — the fastest-warming place in the set. Arctic amplification made visible.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'SMAP soil-moisture values' },
      { id: 'atlantic', lat: 40.0, lng: -30.0, title: 'North Atlantic air temperature', text: '+0.12 °C/decade of marine air temperature. The ocean buffers change — but the signal still trends up.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'GHRSST sea-surface temperature' },
      { id: 'sahel', lat: 13.51, lng: 2.11, title: 'Sahel rainfall', text: 'Precipitation trend with a significance test. Some regions wet, some dry — the same driver, opposite signs.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'GPM IMERG precipitation' },
    ],
  },
  disaster: {
    intro: 'Minutes matter. Anomalies, not sirens.',
    beats: [
      { id: 'nsw', lat: -33.0, lng: 147.0, title: 'Wildfire surge · Australia', text: '2 → 7 detections in 7 days (DG-04 rule). A statistical flag, not a warning — open it for the evidence pack.', status: 'live', source: 'NASA FIRMS + EONET', next: 'GPM precipitation context' },
      { id: 'fakfak', lat: -2.92, lng: 132.3, title: 'Quake cluster · Fakfak', text: '0 → 7 earthquakes in 7 days. The anomaly engine flags the cell and hands it to human review.', status: 'live', source: 'USGS FDSN', next: 'NISAR deformation' },
      { id: 'tokyo', lat: 35.68, lng: 139.69, title: 'M5.5+ exposure · Tokyo', text: 'Seismic exposure within 300 km, from the 30-day USGS feed. Exposure ≠ risk.', status: 'live', source: 'USGS FDSN', next: 'real-time alerting' },
      { id: 'hotspot', lat: 36.7, lng: -119.8, title: 'FIRMS 24-hour hotspot', text: '123,889 active-fire detections aggregated to 1° cells. Yellow = intensity, not burned area.', status: 'live', source: 'NASA FIRMS', next: 'MODIS/VIIRS harmonised history' },
    ],
  },
  agri: {
    intro: 'Food security starts in the soil.',
    beats: [
      { id: 'sahel', lat: 13.51, lng: 2.11, title: 'Sahel soil wetness', text: 'Root-zone wetness (GWETROOT) is a SMAP proxy until the real SMAP feed connects.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'SMAP L3/L4' },
      { id: 'california', lat: 36.7, lng: -119.8, title: 'California precipitation', text: 'Precipitation stress in the Central Valley — the water that decides a growing season.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'Sentinel-2 NDVI' },
      { id: 'punjab', lat: 30.9, lng: 75.85, title: 'Punjab crop belt', text: 'A rotation-planner field region. The kernel allocates a scarce water budget across fields.', status: 'sample', source: 'ORBIT planner (synthetic fields)', next: 'MODIS/VIIRS NDVI' },
    ],
  },
  ocean: {
    intro: 'The ocean holds the planet’s heat.',
    beats: [
      { id: 'atlantic', lat: 40.0, lng: -30.0, title: 'Marine air temperature', text: 'Not SST — POWER over ocean is marine air temperature. Honest about the difference.', status: 'snapshot', source: 'NASA POWER (MERRA-2)', next: 'GHRSST SST' },
      { id: 'greenland', lat: 69.22, lng: -51.1, title: 'Sea-ice events · Ilulissat', text: 'Iceberg and sea-ice records tracked from NASA EONET and the US National Ice Center.', status: 'live', source: 'NASA EONET / USNIC', next: 'PACE ocean colour' },
      { id: 'mediterranean', lat: 36.5, lng: 13.0, title: 'Mediterranean · SST planned', text: 'Sea-surface temperature and ocean colour are planned connectors — shown as imagery only today.', status: 'sample', source: 'NASA GIBS (imagery)', next: 'GHRSST / PACE' },
    ],
  },
  infrastructure: {
    intro: 'Cities rest on ground that can move.',
    beats: [
      { id: 'tokyo', lat: 35.68, lng: 139.69, title: 'Seismic exposure · Tokyo', text: 'Earthquakes within 300 km, max magnitude from the 30-day USGS window.', status: 'live', source: 'USGS FDSN', next: 'NISAR/Sentinel-1 InSAR' },
      { id: 'jakarta', lat: -6.2, lng: 106.85, title: 'Subsidence · Jakarta', text: 'A synthetic displacement grid illustrates the change-detection method. Real InSAR is not connected.', status: 'sample', source: 'ORBIT sample grid', next: 'NISAR / Sentinel-1 SAR' },
      { id: 'la', lat: 34.05, lng: -118.24, title: 'Seismic exposure · Los Angeles', text: 'Fault-adjacent exposure from the same USGS feed. Screening tool, not structural certification.', status: 'live', source: 'USGS FDSN', next: 'asset registry import' },
    ],
  },
  gnss: {
    intro: 'Know when navigation cannot be trusted.',
    beats: [
      { id: 'andoya', lat: 69.29, lng: 16.03, title: 'Interference detection · Andøya', text: 'C/N0 and AGC anomaly detection over Arctic skies. A synthetic trace until a live receiver feed connects.', status: 'sample', source: 'ORBIT GNSS engine (synthetic)', next: 'Arctic Intel Watch integration' },
      { id: 'svalbard', lat: 78.22, lng: 15.65, title: 'High-latitude space weather', text: 'Geomagnetic storms degrade GNSS. NOAA SWPC Kp is shown as context — never as evidence of spoofing.', status: 'live', source: 'NOAA SWPC', next: 'CDDIS ephemeris' },
    ],
  },
  autonomy: {
    intro: 'One planner, two worlds.',
    beats: [
      { id: 'svalbard', lat: 78.22, lng: 15.65, title: 'Drone route · Svalbard', text: 'Energy-limited A* routing on Earth — the same kernel that plans a rover traverse on Mars.', status: 'sample', source: 'ORBIT planner (synthetic terrain)', next: 'HiRISE/MOLA terrain' },
      { id: 'atacama', lat: -23.5, lng: -69.5, title: 'Mars-analog terrain · Atacama', text: 'A dry, cold Earth analog. Validate the planner on Earth first, then ship it off-world.', status: 'sample', source: 'ORBIT transfer pattern', next: 'real Mars DEM' },
    ],
  },
  explorer: {
    intro: 'Practice on Earth, ship to the Moon and Mars.',
    beats: [
      { id: 'atacama', lat: -23.5, lng: -69.5, title: 'Atacama Desert · best Mars analog', text: 'Cold and dry — the top-ranked Mars analog from real NASA POWER climate means.', status: 'snapshot', source: 'NASA POWER (2001–2025 means)', next: 'LRO/MRO imagery' },
      { id: 'dryvalleys', lat: -77.5, lng: 162.0, title: 'McMurdo Dry Valleys', text: 'The driest place on Earth, scored against a Mars climate profile.', status: 'snapshot', source: 'NASA POWER (2001–2025 means)', next: 'MRO imagery' },
      { id: 'iceland', lat: 63.9, lng: -22.4, title: 'Iceland Reykjanes · Moon analog', text: 'Volcanic, freshly-formed terrain — the closest thing to a lunar surface on Earth.', status: 'snapshot', source: 'NASA POWER (2001–2025 means)', next: 'LRO imagery' },
    ],
  },
  academy: {
    intro: 'Fail safely here, so the real mission doesn’t.',
    beats: [
      { id: 'oslo', lat: 59.91, lng: 10.75, title: 'Mission control', text: 'Design a Mars outpost under mass, power and budget limits. A decision game — not engineering data.', status: 'sample', source: 'ORBIT planner (educational)', next: 'Artemis reference material' },
      { id: 'dryvalleys', lat: -77.5, lng: 162.0, title: 'Analog training site', text: 'The same trade-offs a real outpost planner faces, framed through an Earth analog.', status: 'sample', source: 'ORBIT transfer pattern', next: 'junior astronaut trainer (challenge 3)' },
    ],
  },
  human: {
    intro: 'Crews are the most precious payload.',
    beats: [
      { id: 'atlantic', lat: 40.0, lng: -30.0, title: 'ISS low-Earth orbit', text: 'Astronaut health and station science, kept deliberately separate from Earth wildfire data.', status: 'sample', source: 'ORBIT concept (synthetic)', next: 'OSDR research data' },
      { id: 'oslo', lat: 59.91, lng: 10.75, title: 'Concept workspace', text: 'A careful concept: watch the human signal without making medical claims. No flight-safety assertion.', status: 'sample', source: 'ORBIT concept (synthetic)', next: 'validated health monitoring' },
    ],
  },
};
