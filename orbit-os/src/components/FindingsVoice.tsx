import { useEffect, useState } from 'react';
import { Icon } from './ui';

/**
 * Read a findings text aloud with the browser's own speech synthesis.
 *
 * Used where there is no recorded narration asset: the Arctic board reads the
 * numbers that were actually computed from the MET Norway chart and the NSIDC
 * series. If the browser exposes no voice we say so instead of leaving a button
 * that does nothing. Long text is split at sentence boundaries because some
 * engines truncate a single long utterance.
 */
export function FindingsVoice({
  text,
  label = 'Read the findings',
  className = 'btn-ghost !py-1.5 text-xs',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const sync = () => setSpeaking(window.speechSynthesis.speaking);
    const t = window.setInterval(sync, 500);
    return () => {
      window.clearInterval(t);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported) {
    return (
      <button disabled className={`${className} cursor-not-allowed opacity-50`} title="This browser has no speech synthesis">
        <Icon name="Volume2" />
        {label}
      </button>
    );
  }

  const speak = () => {
    const synth = window.speechSynthesis;
    if (synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const voices = synth.getVoices();
    if (!voices.length) {
      setErr('no voice installed');
      return;
    }
    const preferred =
      voices.find((v) => /en-GB/i.test(v.lang) && /(Daniel|Serena|Google UK English Male)/i.test(v.name)) ??
      voices.find((v) => /en-GB/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang)) ??
      voices[0];

    const chunks = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) ?? [text];
    chunks.forEach((chunk) => {
      const u = new SpeechSynthesisUtterance(chunk.trim());
      u.voice = preferred;
      u.lang = preferred.lang;
      u.rate = 0.98;
      u.pitch = 1;
      u.onend = () => setSpeaking(synth.speaking);
      u.onerror = () => {
        setErr('speech failed');
        setSpeaking(false);
      };
      synth.speak(u);
    });
    setErr(null);
    setSpeaking(true);
  };

  return (
    <button className={className} onClick={speak} title={err ?? 'Browser speech synthesis · no recording for this board'}>
      <Icon name={speaking ? 'Pause' : 'Volume2'} />
      {speaking ? 'Stop reading' : label}
      {err && <span className="text-[10px] text-amber-300">{err}</span>}
    </button>
  );
}

export default FindingsVoice;
