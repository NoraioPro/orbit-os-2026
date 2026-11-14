import { useEffect, useState } from 'react';
import { OrbitGlobe } from './OrbitGlobe';
import { StatusBadge } from './ui';
import type { EventsDB } from '../data/events';
import type { StoryBeat } from '../data/stories';

/** A guided story tour over the 3D globe: camera centres each beat, a caption explains it,
 *  and the tour auto-advances (or the user steps through). Wraps OrbitGlobe for Earth data. */
export function StoryGlobe({ beats, db, types, height = 400 }: { beats: StoryBeat[]; db: EventsDB | null; types?: string[]; height?: number }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = beats.length;
  const beat = beats[Math.min(i, n - 1)];

  useEffect(() => {
    if (!playing || n < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6000);
    return () => clearTimeout(t);
  }, [playing, i, n]);

  useEffect(() => setI(0), [beats]);
  const goto = (d: number) => setI((x) => (x + d + n) % n);

  if (!beat) return null;
  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <OrbitGlobe db={db} focus={{ lat: beat.lat, lng: beat.lng, altitude: 1.6 }} types={types} height={height} autoRotate={false} />
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        {n > 1 && <button className="btn-ghost !px-2 !py-1 text-sm leading-none" onClick={() => goto(-1)} aria-label="Previous beat">‹</button>}
        <button className="btn-primary !px-3 !py-1 text-xs" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play story'}</button>
        {n > 1 && <button className="btn-ghost !px-2 !py-1 text-sm leading-none" onClick={() => goto(1)} aria-label="Next beat">›</button>}
      </div>
      <div className="absolute inset-x-3 bottom-3 z-10">
        <div className="rounded-xl border border-white/15 bg-slate-950/85 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 text-sm font-semibold text-white"><span className="text-xs text-sky-300">{i + 1}/{n}</span>{beat.title}</div>
            <StatusBadge status={beat.status} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{beat.text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>Source: <span className="text-slate-400">{beat.source}</span></span>
            {beat.next && <span>Next phase: <span className="text-violet-300">{beat.next}</span></span>}
          </div>
        </div>
        {n > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {beats.map((b, k) => (
              <button key={b.id} onClick={() => { setPlaying(false); setI(k); }} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-sky-400' : 'w-1.5 bg-white/25'}`} aria-label={b.title} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
