import { useEffect, useState } from 'react';
import { Icon } from './ui';
import { sonifySeries, stopSonify } from '../lib/audio';

/**
 * "Listen" for a numeric series (challenge 14, Earth Sound Jukebox).
 *
 * Shows three honest states instead of a button that may or may not have made a
 * sound: idle, playing (with a Stop affordance), and unavailable — when the
 * browser exposes no Web Audio we say so rather than fail silently. A second
 * series stops the first.
 */
export function SonifyButton({
  values,
  label = 'Listen',
  title = 'Challenge 14: hear the data',
  className = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sky-300 hover:bg-sky-500/10',
}: {
  values: number[];
  label?: string;
  title?: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => () => stopSonify(), []);

  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return null;

  return (
    <button
      type="button"
      className={className}
      title={err ?? title}
      onClick={() => {
        setErr(null);
        if (playing) {
          stopSonify();
          setPlaying(false);
          return;
        }
        const started = sonifySeries(usable);
        if (!started) {
          setErr('This browser has no Web Audio, so the series cannot be played.');
          return;
        }
        setPlaying(true);
        const ms = usable.length * 180 + 250;
        window.setTimeout(() => setPlaying(false), ms);
      }}
    >
      <Icon name={playing ? 'Pause' : 'Music'} className="h-3.5 w-3.5" />
      {playing ? 'Stop' : label}
      {err && <span className="text-[10px] text-amber-300">no audio</span>}
    </button>
  );
}

export default SonifyButton;
