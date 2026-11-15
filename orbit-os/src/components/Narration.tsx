import { useEffect, useState } from 'react';
import { Icon } from './ui';
import { narrationState, onNarrationChange, playNarration, stopNarration } from '../lib/audio';

/**
 * Play/pause narration.
 *
 * Three states are visible to the user, because they are genuinely different:
 *   - no asset dropped in yet -> disabled button that says so
 *   - asset present, playing  -> Pause + level meter + elapsed/duration
 *   - playback failed         -> the actual reason on the button
 * Only one narration plays at a time; starting another stops the first.
 */
export function NarrationButton({ src, label = 'Play narration' }: { src?: string; label?: string }) {
  const [, force] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const off = onNarrationChange(() => force((n) => n + 1));
    return () => {
      off();
    };
  }, []);
  useEffect(() => setFailed(null), [src]);

  if (!src) {
    return (
      <button
        disabled
        title="Narration not added yet: drop the mp3 into /assets/audio and list it in manifest.json"
        className="btn-ghost cursor-not-allowed !py-1.5 text-xs opacity-50"
      >
        <Icon name="Volume2" />
        {label}
      </button>
    );
  }

  const st = narrationState(src);
  const failure = failed ?? (st.failed ? 'audio failed to decode' : null);

  return (
    <button
      className={`btn-ghost !py-1.5 text-xs ${st.playing ? 'border-sky-400/50 text-sky-200 shadow-glow' : ''}`}
      title={failure ?? src}
      onClick={async () => {
        setFailed(null);
        if (st.playing) {
          stopNarration();
          return;
        }
        const res = await playNarration(src);
        if (!res.ok) setFailed(res.message || 'audio failed to start');
      }}
    >
      <Icon name={st.playing ? 'Pause' : 'Volume2'} />
      {st.playing ? 'Pause narration' : label}
      {st.playing && (
        <>
          <span className="flex h-3 items-end gap-[2px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="eq w-[3px] rounded bg-sky-300" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          {st.duration > 0 && (
            <span className="font-mono text-[10px] text-sky-300/80">
              {Math.floor(st.time)}s / {Math.round(st.duration)}s
            </span>
          )}
        </>
      )}
      {!st.playing && failure && <span className="text-[10px] text-amber-300">{failure}</span>}
    </button>
  );
}

export default NarrationButton;
