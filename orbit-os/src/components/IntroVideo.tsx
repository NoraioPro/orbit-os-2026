// Cinematic intro video overlay. Plays once per browser session on launch; replay via <IntroVideoButton/>.
import { useEffect, useRef, useState } from 'react';

export const INTRO_VIDEO = '/assets/video/orbit-os-intro.mp4';
const KEY = 'orbit.introSeen';

export function IntroVideo({ open, onClose, narration }: { open: boolean; onClose: () => void; narration?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  const a = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (!open) return;
    sessionStorage.setItem(KEY, '1');
    v.current?.play().catch(() => {});
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); a.current?.pause(); };
  }, [open, onClose]);
  if (!open) return null;
  const unmute = () => {
    setMuted(false);
    if (v.current) { v.current.muted = false; v.current.currentTime = 0; v.current.play().catch(() => {}); }
    if (narration) { a.current ??= new Audio(narration); a.current.currentTime = 0; a.current.play().catch(() => {}); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" role="dialog" aria-label="ORBIT OS intro">
      <video ref={v} src={INTRO_VIDEO} className="h-full w-full object-cover" autoPlay muted={muted} playsInline onEnded={() => { if (!a.current || a.current.paused || a.current.ended) onClose(); }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      <div className="absolute bottom-10 left-10 text-left">
        <div className="text-4xl font-bold tracking-tight text-white drop-shadow">ORBIT OS</div>
        <div className="mt-1 text-lg text-sky-300">One Change Engine, Many Worlds</div>
      </div>
      <div className="absolute bottom-10 right-10 flex gap-3">
        {muted && <button onClick={unmute} className="rounded-xl border border-sky-300/40 bg-slate-900/70 px-4 py-2 text-sm text-white backdrop-blur hover:border-sky-300">Play with sound</button>}
        <button onClick={onClose} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/20">Skip intro</button>
      </div>
    </div>
  );
}

export const introSeen = () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(KEY) === '1';
