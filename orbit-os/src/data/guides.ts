import type { ModuleId } from './modules';

export interface ModuleGuide { focus: string[]; howto: string[] }

/** Per-module focus (which event types its story globe shows) and a 3-step "how to use". */
export const GUIDES: Record<ModuleId, ModuleGuide> = {
  earth: { focus: ['wildfires'], howto: ['Pick a place and a climate variable', 'Read the trend, significance and forecast', 'Open the evidence pack or listen'] },
  disaster: { focus: ['earthquake', 'wildfires', 'floods', 'volcanoes', 'severeStorms', 'seaLakeIce'], howto: ['Filter by event type', 'Click any flag to open its evidence', 'Run the demo for a worked anomaly'] },
  agri: { focus: [], howto: ['Choose a field region', 'Check soil-wetness and rainfall stress', 'Adjust the water budget and see the plan'] },
  ocean: { focus: ['seaLakeIce'], howto: ['Pick a marine region', 'Read the air-temperature trend', 'Track ice events and open evidence'] },
  infrastructure: { focus: ['earthquake'], howto: ['Pick a city', 'See seismic exposure within 300 km', 'Review the radar-change grid'] },
  gnss: { focus: [], howto: ['Load a GnssLogger recording', 'Read the integrity score and events', 'Run a scenario in the simulation lab'] },
  autonomy: { focus: [], howto: ['Switch Earth ↔ Mars', 'Watch the planner route around obstacles', 'Compare the energy cost'] },
  explorer: { focus: [], howto: ['Rank Earth analogs against Mars/Moon', 'Read the scores', 'Run as a full investigation'] },
  academy: { focus: [], howto: ['Set a mass budget', 'Choose outpost modules', 'See the mission-value trade-off'] },
  human: { focus: [], howto: ['Review the HR anomaly trace', 'Read the concept notes', 'Keep ISS combustion separate'] },
  sar: { focus: [], howto: ['Pick a study area', 'Swipe before/after and set the threshold', 'Check displacement and cross-links'] },
  defense: { focus: [], howto: ['Watch the live satellite swarm', 'Read the real-time situation panels', 'Review the free data sources behind it'] },
};
