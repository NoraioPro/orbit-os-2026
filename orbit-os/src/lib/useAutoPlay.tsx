import { useEffect, useRef, useState } from 'react';

/**
 * Play a dated series like a small film.
 *
 * Used wherever a panel shows the same place on several dates (HLS/OPERA tiles,
 * the ice-chart archive): the frames advance on a timer so the change is visible
 * without clicking, and any manual pick pauses it so you can study one frame.
 */
export function useAutoPlay(count: number, intervalMs = 1500, startIndex = 0, autoStart = false) {
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  // slide-show behaviour: sequences start on their own unless the caller opts out
  const startedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || startedRef.current || count < 2) return;
    startedRef.current = true;
    setPlaying(true);
  }, [autoStart, count]);
  const [tick, setTick] = useState(0);
  const timer = useRef<number | null>(null);

  // keep the index inside the series when the layer/AOI changes
  useEffect(() => {
    setIndex((i) => Math.min(Math.max(0, i), Math.max(0, count - 1)));
  }, [count]);

  useEffect(() => {
    if (!playing || count < 2) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setTick((t) => t + 1);
    }, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, count, intervalMs]);

  const goto = (i: number) => {
    setPlaying(false);
    setIndex(Math.min(Math.max(0, i), Math.max(0, count - 1)));
  };

  return {
    index,
    playing,
    tick,
    goto,
    toggle: () => setPlaying((p) => !p),
    pause: () => setPlaying(false),
    next: () => setIndex((i) => (i + 1) % Math.max(1, count)),
    prev: () => setIndex((i) => (i - 1 + Math.max(1, count)) % Math.max(1, count)),
  };
}

/** Progress bar + play/pause + frame dots for an auto-playing series. */
export function PlayBar({
  count,
  index,
  playing,
  onToggle,
  onPick,
  label,
  intervalMs = 1500,
}: {
  count: number;
  index: number;
  playing: boolean;
  onToggle: () => void;
  onPick: (i: number) => void;
  label?: string;
  intervalMs?: number;
}) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        title={playing ? 'Pause the sequence' : `Play the ${count} dates`}
        className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] transition ${
          playing ? 'border-sky-400/50 bg-sky-500/20 text-sky-200' : 'border-white/10 text-slate-300 hover:border-white/25'
        }`}
      >
        {playing ? '❚❚' : '▶'} {label ?? 'play'}
      </button>
      <div className="flex items-center gap-[3px]">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(i)}
            title={`frame ${i + 1} of ${count}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-sky-300' : 'w-1.5 bg-white/25 hover:bg-white/50'}`}
          />
        ))}
      </div>
      <span className="text-[8px] text-slate-500">{(intervalMs / 1000).toFixed(1)}s/frame</span>
    </div>
  );
}
