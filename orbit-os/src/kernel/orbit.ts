// Orbital mechanics: Keplerian propagation of CelesTrak mean elements to a ground track.
// Honest scope: simplified — no J2, drag or SGP4, so positions are APPROXIMATE (good to ~tens of km).
// Used by the Defense & Crisis situation room to map the live satellite population.

const MU = 398600.4418; // km^3/s^2
const EARTH_R = 6378.137; // km
const DAY_S = 86400;
const D2R = Math.PI / 180;

export interface GpElements {
  meanMotionRevDay: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  epochMs: number;
}

export interface GeoPoint { lat: number; lon: number; altKm: number }

function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/** Greenwich Mean Sidereal Time (radians) at a UTC instant. */
function gmstRad(utcMs: number): number {
  const JD = utcMs / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  let deg = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  deg = ((deg % 360) + 360) % 360;
  return deg * D2R;
}

/** Propagate a set of mean orbital elements to a UTC instant, returning a geodetic ground point. */
export function gpPosition(g: GpElements, atMs: number): GeoPoint {
  const n = (g.meanMotionRevDay * 2 * Math.PI) / DAY_S; // rad/s
  const a = Math.cbrt(MU / (n * n)); // km
  const e = g.eccentricity;
  const i = g.inclinationDeg * D2R;
  const raan = g.raanDeg * D2R;
  const w = g.argPerigeeDeg * D2R;
  const M = g.meanAnomalyDeg * D2R + n * ((atMs - g.epochMs) / 1000);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
  const cO = Math.cos(raan), sO = Math.sin(raan);
  const ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(w), sw = Math.sin(w);
  const x = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
  const y = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;
  const th = gmstRad(atMs);
  const ct = Math.cos(th), st = Math.sin(th);
  const xe = ct * x + st * y;
  const ye = -st * x + ct * y;
  const rxy = Math.hypot(xe, ye);
  return { lat: Math.atan2(z, rxy) / D2R, lon: Math.atan2(ye, xe) / D2R, altKm: Math.hypot(xe, ye, z) - EARTH_R };
}

/** Classify a satellite into an orbital shell for the situation-room map. */
export function orbitClass(name: string, altKm: number, ecc: number, incDeg: number): string {
  if (/starlink/i.test(name)) return 'starlink';
  if (altKm > 35000 && altKm < 38000 && ecc < 0.01 && Math.abs(incDeg) < 8) return 'geo';
  if (altKm >= 2000 && altKm <= 45000) return 'meo';
  if (altKm < 2000) return 'leo';
  return 'other';
}

export const ORBIT_CLASSES: Record<string, { label: string; color: string }> = {
  leo: { label: 'LEO', color: '#38bdf8' },
  meo: { label: 'MEO', color: '#fbbf24' },
  geo: { label: 'GEO', color: '#e879f9' },
  starlink: { label: 'Starlink', color: '#7dd3fc' },
  other: { label: 'Other', color: '#94a3b8' },
};
