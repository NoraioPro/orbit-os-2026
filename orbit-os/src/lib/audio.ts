/**
 * Single audio authority for the app.
 *
 * Why this exists: the narration buttons each built their own <audio> element and
 * the sonifier built its own AudioContext per click. Browsers cap the number of
 * AudioContexts (usually 6) and suspend anything created outside a user gesture,
 * so after a few "Listen" presses the app went silent with no error shown. There is
 * now exactly one narration element and one AudioContext, both resumed on the
 * gesture that starts playback.
 */

type Listener = () => void;

/* ------------------------------ narration ------------------------------ */

let narrationEl: HTMLAudioElement | null = null;
const narrationSubs = new Set<Listener>();

function notifyNarration() {
  narrationSubs.forEach((fn) => fn());
}

export function onNarrationChange(fn: Listener) {
  narrationSubs.add(fn);
  return () => narrationSubs.delete(fn);
}

export function stopNarration() {
  if (narrationEl) {
    narrationEl.pause();
    narrationEl.currentTime = 0;
    notifyNarration();
  }
}

export function currentNarrationSrc() {
  return narrationEl?.currentSrc || narrationEl?.src || null;
}

export interface PlayResult {
  ok: boolean;
  reason?: 'blocked' | 'missing' | 'error';
  message?: string;
}

/** Play one narration at a time; any other narration on screen stops. */
export async function playNarration(src: string): Promise<PlayResult> {
  try {
    const url = new URL(src, window.location.href).href;
    if (narrationEl && narrationEl.src !== url) {
      narrationEl.pause();
      narrationEl = null;
    }
    if (!narrationEl) {
      narrationEl = new Audio();
      narrationEl.preload = 'auto';
      narrationEl.addEventListener('ended', () => notifyNarration());
      narrationEl.addEventListener('pause', () => notifyNarration());
      narrationEl.addEventListener('play', () => notifyNarration());
      narrationEl.addEventListener('error', () => notifyNarration());
    }
    if (narrationEl.src !== url) narrationEl.src = url;
    narrationEl.muted = false;
    narrationEl.volume = 1;
    await narrationEl.play();
    notifyNarration();
    return { ok: true };
  } catch (e) {
    const err = e as DOMException;
    const blocked = err?.name === 'NotAllowedError';
    notifyNarration();
    return {
      ok: false,
      reason: blocked ? 'blocked' : 'error',
      message: blocked ? 'The browser blocked autoplay — press Listen again.' : err?.message || 'audio failed to start',
    };
  }
}

export function narrationState(src: string) {
  if (!narrationEl) return { playing: false, time: 0, duration: 0, ready: false, failed: false };
  const same = narrationEl.src === new URL(src, window.location.href).href;
  return {
    playing: same && !narrationEl.paused && !narrationEl.ended,
    time: same ? narrationEl.currentTime : 0,
    duration: same && Number.isFinite(narrationEl.duration) ? narrationEl.duration : 0,
    ready: narrationEl.readyState >= 2,
    failed: narrationEl.error !== null,
  };
}

/* ------------------------------ sonification ------------------------------ */

let ctx: AudioContext | null = null;
let sonifyStop: (() => void) | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx || ctx.state === 'closed') ctx = new Ctx();
  return ctx;
}

export function stopSonify() {
  sonifyStop?.();
  sonifyStop = null;
}

/**
 * Play a numeric series as pitch. One note per point, oldest to newest.
 * Returns false when the browser has no Web Audio, so callers can say so
 * instead of showing a button that silently does nothing.
 */
export function sonifySeries(values: number[], noteMs = 180): boolean {
  const ac = audioContext();
  if (!ac || values.length === 0) return false;

  // the click that triggered this is a user gesture; resume in case it was suspended
  void ac.resume();

  stopSonify();

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const master = ac.createGain();
  master.gain.value = 0.22;
  master.connect(ac.destination);

  const nodes: OscillatorNode[] = [];
  const t0 = ac.currentTime + 0.05;
  values.forEach((v, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = t0 + (i * noteMs) / 1000;
    const span = hi - lo || 1;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + ((v - lo) / span) * 660, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + noteMs / 1000);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + noteMs / 1000 + 0.02);
    nodes.push(osc);
  });

  const total = (values.length * noteMs) / 1000 + 0.2;
  const timer = window.setTimeout(() => {
    nodes.forEach((n) => n.disconnect());
    master.disconnect();
    sonifyStop = null;
  }, total * 1000);

  sonifyStop = () => {
    window.clearTimeout(timer);
    nodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    });
    master.disconnect();
  };

  return true;
}
