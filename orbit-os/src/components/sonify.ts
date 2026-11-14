// Challenge 14 (Earth Sound Jukebox) reused: any evidence series can be played as pitch.
import type { SeriesPoint } from '../kernel';
export function sonify(points: SeriesPoint[], noteMs = 180) {
  const vals = points.map((p) => p.y).filter((v): v is number => v !== null);
  if (!vals.length) return;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  const lo = Math.min(...vals), hi = Math.max(...vals);
  vals.forEach((v, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 220 + ((v - lo) / (hi - lo || 1)) * 660;
    const t = ctx.currentTime + (i * noteMs) / 1000;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.linearRampToValueAtTime(0, t + noteMs / 1000);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + noteMs / 1000 + 0.02);
  });
  setTimeout(() => ctx.close(), vals.length * noteMs + 500);
}
