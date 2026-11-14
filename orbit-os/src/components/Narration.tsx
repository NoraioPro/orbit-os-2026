import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

/** Play/pause narration. Renders a disabled placeholder when the asset has not been dropped in yet. */
export function NarrationButton({ src, label = 'Play narration' }: { src?: string; label?: string }) {
  const a = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(!src);
  useEffect(() => { setMissing(!src); setPlaying(false); a.current?.pause(); a.current = src ? new Audio(src) : null; if (a.current) { a.current.onended = () => setPlaying(false); a.current.onerror = () => setMissing(true); } return () => a.current?.pause(); }, [src]);
  if (missing) return <button disabled title="Narration not added yet: drop the mp3 into /assets and list it in manifest.json" className="btn-ghost cursor-not-allowed !py-1.5 text-xs opacity-50"><Icon name="Volume2" />{label}</button>;
  return (
    <button className={`btn-ghost !py-1.5 text-xs ${playing ? 'border-sky-400/50 text-sky-200 shadow-glow' : ''}`} onClick={() => { if (!a.current) return; if (playing) { a.current.pause(); setPlaying(false); } else { a.current.play().then(() => setPlaying(true)).catch(() => setMissing(true)); } }}>
      <Icon name={playing ? 'Pause' : 'Volume2'} />{playing ? 'Pause narration' : label}
      {playing && <span className="flex h-3 items-end gap-[2px]">{[0, 1, 2].map((i) => <span key={i} className="eq w-[3px] rounded bg-sky-300" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
    </button>
  );
}
