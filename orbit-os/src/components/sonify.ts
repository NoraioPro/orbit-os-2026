// Challenge 14 (Earth Sound Jukebox) reused: any evidence series can be played as pitch.
// All Web Audio handling lives in lib/audio, so one AudioContext serves the whole app —
// a context per click used to exhaust the browser's limit and then play nothing.
import type { SeriesPoint } from '../kernel';
import { sonifySeries, stopSonify } from '../lib/audio';

/** Returns false when the browser has no Web Audio or the series is empty. */
export function sonify(points: SeriesPoint[], noteMs = 180): boolean {
  const vals = points.map((p) => p.y).filter((v): v is number => v !== null);
  if (!vals.length) return false;
  return sonifySeries(vals, noteMs);
}

export { stopSonify };
