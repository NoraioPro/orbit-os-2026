// Pattern 6: EARTH ANALOG -> MOON / MARS TRANSFER
export interface WorldProfile { id: string; name: string; meanTempC: number; precipMmDay: number; solarMJ: number; note: string }

/**
 * Reference profiles (approximate literature values, labelled SAMPLE in the UI):
 * Mars mean surface ~ -63 °C, no liquid precipitation, mean surface insolation ~ 590 W/m² TOA x atmosphere -> ~ 9-12 MJ/m²/day at equator.
 * Moon (polar, permanently shadowed fringe) ~ -170..-20 °C, no precipitation, solar ~ highly variable.
 */
export const WORLDS: WorldProfile[] = [
  { id: 'mars', name: 'Mars (Jezero-like, equatorial)', meanTempC: -63, precipMmDay: 0, solarMJ: 10, note: 'Approximate reference values (sample), not mission data.' },
  { id: 'moon', name: 'Moon (south polar region)', meanTempC: -120, precipMmDay: 0, solarMJ: 6, note: 'Approximate reference values (sample), not mission data.' },
];

/** Similarity 0..1 from normalised distance on aridity, cold and light. */
export function analogScore(site: { tempC: number; precipMmDay: number; solarMJ: number }, w: WorldProfile) {
  const dT = Math.min(1, Math.abs(site.tempC - w.meanTempC) / 90);
  const dP = Math.min(1, Math.abs(site.precipMmDay - w.precipMmDay) / 4);
  const dS = Math.min(1, Math.abs(site.solarMJ - w.solarMJ) / 25);
  const d = 0.45 * dT + 0.4 * dP + 0.15 * dS;
  return { score: 1 - d, parts: { cold: 1 - dT, aridity: 1 - dP, light: 1 - dS } };
}
