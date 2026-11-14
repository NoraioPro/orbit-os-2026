import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { loadEvents, type EventsDB } from '../data/events';
import { loadPowerSnapshot, PLACES } from '../data/power';
import { climatology } from '../kernel';
import type { DataStatus, SeriesPoint } from '../kernel';

/* ------------------------------------------------------------------ *
 * Challenge 14 — Earth Sound Jukebox
 * Sonify real Earth data into looping, interactive sound using only the
 * Web Audio API (oscillators + gain nodes — no audio files, no new deps).
 *
 * Two sources, both real and honestly labelled:
 *  · Climate mode — NASA POWER (MERRA-2/CERES) monthly series, bundled
 *    snapshot via loadPowerSnapshot(). Temperature → pitch, precipitation
 *    → rhythm & amplitude, looping over the 12-month climatology.
 *  · Seismic mode — USGS earthquakes via loadEvents('harvest') (falls back
 *    to the 86-shard snapshot). Magnitude → note intensity & pitch.
 *
 * Mappings are FIXED and interpretable (not per-place normalised), so a
 * cold place always sounds low and a hot place high. No values are invented.
 * ------------------------------------------------------------------ */

type Mode = 'climate' | 'seismic';

interface Note {
  at: number; // seconds offset within the step
  dur: number; // seconds
  freq: number; // Hz
  gain: number; // 0..1 amplitude
  type: OscillatorType;
}
interface Step {
  notes: Note[];
  label: string; // short label for the step strip
  title: string; // human detail (tooltip / now-playing)
  value: number; // driving value
  norm: number; // 0..1 normalised driving value (for colour/height)
}

/* Fixed, interpretable mapping bounds (shared across every place). */
const TEMP_MIN = -20; // °C
const TEMP_MAX = 35; // °C
const PRECIP_MAX = 20; // mm/day cap
const MAG_MIN = 2.5; // harvest is USGS M2.5+
const MAG_MAX = 8.0;
const CLIMATE_STEP = 0.5; // seconds per month
const SEISMIC_STEP = 0.22; // seconds per quake
const MAX_QUAKES = 48;

/* Major-pentatonic scale (C3 upward, 3 octaves) so any temperature maps to a
 * consonant pitch instead of a continuous (dissonant) frequency sweep. */
const PENTA = [0, 2, 4, 7, 9];
const SCALE: number[] = (() => {
  const out: number[] = [];
  for (let o = 0; o < 3; o++) for (const s of PENTA) out.push(48 + o * 12 + s);
  return out;
})();
const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const RAIN_MIDI = 84; // C6 — the "rain drop" ping

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function climateSteps(t2m: SeriesPoint[], precip: SeriesPoint[]): Step[] {
  return MONTHS.map((m, i) => {
    const t = t2m[i]?.y ?? null;
    const p = precip[i]?.y ?? null;
    const tVal = t === null ? TEMP_MIN : t;
    const pVal = p === null ? 0 : p;
    const tempNorm = clamp01((tVal - TEMP_MIN) / (TEMP_MAX - TEMP_MIN));
    const precipNorm = clamp01(pVal / PRECIP_MAX);
    const freq = midiFreq(SCALE[Math.round(tempNorm * (SCALE.length - 1))]);
    const rain = 1 + Math.round(precipNorm * 6); // 1..7 ticks
    const notes: Note[] = [{ at: 0, dur: CLIMATE_STEP * 0.85, freq, gain: 0.08 + tempNorm * 0.1, type: 'sine' }];
    const rainGain = 0.03 + precipNorm * 0.15;
    for (let k = 0; k < rain; k++) {
      notes.push({ at: (k * CLIMATE_STEP) / rain + 0.02, dur: 0.05, freq: midiFreq(RAIN_MIDI + (k % 4) * 3), gain: rainGain, type: 'triangle' });
    }
    return {
      notes,
      label: m,
      title: t === null ? `${m}: no data` : `${m}: ${t.toFixed(1)} °C · ${(p ?? 0).toFixed(2)} mm/d`,
      value: tVal,
      norm: tempNorm,
    };
  });
}

function seismicSteps(db: EventsDB): Step[] {
  const quakes = db.events
    .filter((e) => e.type === 'earthquake' && e.mag !== null && Number.isFinite(e.mag))
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_QUAKES);
  return quakes.map((q) => {
    const mag = q.mag as number;
    const norm = clamp01((mag - MAG_MIN) / (MAG_MAX - MAG_MIN));
    const gain = 0.05 + norm * 0.5;
    const freq = 150 - norm * 95; // M8 ≈ 55 Hz rumble, M2.5 ≈ 150 Hz
    const day = new Date(q.t).toISOString().slice(0, 10);
    return {
      notes: [
        { at: 0, dur: SEISMIC_STEP * 0.8, freq, gain, type: 'triangle' },
        { at: 0, dur: 0.035, freq: freq * 3, gain: gain * 0.5, type: 'sine' }, // impact transient
      ],
      label: `M${mag.toFixed(1)}`,
      title: `${q.title} · ${day}${q.depth !== null ? ` · ${q.depth} km` : ''}`,
      value: mag,
      norm,
    };
  });
}

const hue = (mode: Mode, norm: number) => (mode === 'climate' ? 205 - norm * 205 : 45 - norm * 45);

export function EarthJukebox() {
  const [mode, setMode] = useState<Mode>('climate');
  const [placeId, setPlaceId] = useState('norway');
  const [playing, setPlaying] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [retrieved, setRetrieved] = useState('');
  const [playhead, setPlayhead] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.6);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stepsRef = useRef<Step[]>([]);
  const modeRef = useRef<Mode>(mode);
  const schedulerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextTimeRef = useRef(0);
  const stepIdxRef = useRef(0);
  const playheadRef = useRef(-1);
  const volumeRef = useRef(volume);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopScheduler = () => {
    if (schedulerRef.current !== null) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
  };
  const stopRaf = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  /* ---------------- data loading ---------------- */
  useEffect(() => {
    let alive = true;
    stopScheduler();
    stopRaf();
    ctxRef.current?.suspend().catch(() => {});
    setPlaying(false);
    setPlayhead(-1);
    playheadRef.current = -1;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (mode === 'climate') {
          const s = await loadPowerSnapshot();
          const rec = s.places[placeId];
          if (!rec) throw new Error('No POWER snapshot for this place. ORBIT will not invent values.');
          const t2m = climatology(rec.parameter.T2M, s.start, s.end);
          const pre = climatology(rec.parameter.PRECTOTCORR, s.start, s.end);
          if (!alive) return;
          setSteps(climateSteps(t2m, pre));
          setStatus('snapshot');
          setStatusNote(`NASA POWER (MERRA-2/CERES) monthly climatology ${s.start}–${s.end}`);
          setSourceName('NASA POWER — bundled offline snapshot');
          setRetrieved(s.retrieved_utc);
        } else {
          const db = await loadEvents('harvest');
          if (!alive) return;
          setSteps(seismicSteps(db));
          setStatus(db.status);
          setStatusNote(db.label);
          setSourceName(db.source === 'harvest' ? 'USGS M2.5+ past month (collector harvest)' : 'USGS ComCat / NASA EONET (shard snapshot)');
          setRetrieved(db.meta.snapshot_utc);
        }
      } catch (e) {
        if (alive) { setError(String((e as Error)?.message || e)); setSteps([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, placeId]);

  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  /* ---------------- audio engine ---------------- */
  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor!();
      const master = ctx.createGain();
      master.gain.value = volumeRef.current;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
      analyserRef.current = analyser;
    }
    return ctxRef.current;
  };

  const scheduleNote = (n: Note, t: number) => {
    const ctx = ctxRef.current!;
    const master = masterRef.current!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = n.type;
    o.frequency.value = n.freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.gain, t + Math.min(0.02, n.dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + n.dur + 0.05);
  };

  const stepDur = () => (modeRef.current === 'climate' ? CLIMATE_STEP : SEISMIC_STEP);

  const tick = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const list = stepsRef.current;
    if (!list.length) return;
    const dur = stepDur();
    const ahead = ctx.currentTime + 0.25;
    while (nextTimeRef.current < ahead) {
      const idx = stepIdxRef.current % list.length;
      const step = list[idx];
      for (const n of step.notes) scheduleNote(n, nextTimeRef.current + n.at);
      if (idx !== playheadRef.current) { playheadRef.current = idx; setPlayhead(idx); }
      nextTimeRef.current += dur;
      stepIdxRef.current += 1;
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (canvas && analyser) {
      const c = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      c.clearRect(0, 0, w, h);
      const bars = 48;
      const stride = Math.max(1, Math.floor(data.length / bars));
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < stride; j++) sum += data[i * stride + j];
        const v = sum / stride / 255;
        const bh = Math.max(2, v * (h - 4));
        c.fillStyle = `hsla(${200 - v * 60}, 85%, ${55 + v * 20}%, 0.9)`;
        c.fillRect((i / bars) * w + 1, h - bh, w / bars - 2, bh);
      }
    }
    rafRef.current = requestAnimationFrame(draw);
  };
  const startRaf = () => { if (rafRef.current === null) rafRef.current = requestAnimationFrame(draw); };

  const play = () => {
    const ctx = ensureCtx();
    void ctx.resume();
    nextTimeRef.current = ctx.currentTime + 0.06;
    stepIdxRef.current = 0;
    playheadRef.current = -1;
    setPlayhead(0);
    setPlaying(true);
    stopScheduler();
    schedulerRef.current = window.setInterval(tick, 60);
    startRaf();
  };

  const pause = () => {
    stopScheduler();
    stopRaf();
    ctxRef.current?.suspend().catch(() => {});
    setPlaying(false);
  };

  const onVolume = (v: number) => {
    setVolume(v);
    volumeRef.current = v;
    if (masterRef.current && ctxRef.current) masterRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.02);
  };

  useEffect(() => () => {
    stopScheduler();
    stopRaf();
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeName = PLACES.find((p) => p.id === placeId)?.name ?? placeId;
  const current = playhead >= 0 ? steps[playhead] : null;

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Music" className="h-5 w-5 text-sky-300" />
          <div className="h-title">Earth Sound Jukebox · challenge 14</div>
        </div>
        {status && <StatusBadge status={status} note={statusNote} />}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        Real Earth data turned into sound — synthesised live with Web Audio API oscillators (no audio files).
        {sourceName && <> Source: <b className="text-slate-300">{sourceName}</b>{retrieved ? <> · retrieved {retrieved.slice(0, 16).replace('T', ' ')} UTC</> : null}.</>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary !py-1.5" onClick={playing ? pause : play} disabled={!steps.length}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? 'Pause' : 'Play'}
        </button>
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          {(['climate', 'seismic'] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-2 py-1 text-xs ${mode === m ? 'bg-sky-500/30 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {m === 'climate' ? 'Climate · POWER' : 'Seismic · USGS'}
            </button>
          ))}
        </div>
        {mode === 'climate' && (
          <select aria-label="Place" className="input !w-auto !py-1" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            {PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <Volume2 className="h-4 w-4" />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(+e.target.value)} className="w-24" />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {mode === 'climate' ? (
          <>
            <Chip>pitch ← temperature (−20…35 °C)</Chip>
            <Chip>rhythm &amp; volume ← precipitation (0…20 mm/d)</Chip>
            <Chip>12-month climatology loop · {placeName}</Chip>
          </>
        ) : (
          <>
            <Chip>intensity &amp; pitch ← magnitude (M2.5…M8)</Chip>
            <Chip>{MAX_QUAKES} most recent quakes loop</Chip>
          </>
        )}
      </div>

      {current && playing && (
        <div className="mt-2 text-xs text-slate-300">
          <b className="text-sky-300">now:</b> {current.title}
        </div>
      )}

      <canvas ref={canvasRef} width={640} height={120} className="mt-3 h-28 w-full rounded-lg border border-white/10 bg-black/30" />

      <div className="mt-2 flex h-10 items-end gap-[2px]">
        {steps.map((st, i) => (
          <div
            key={i}
            title={st.title}
            className={`flex-1 rounded-t ${i === playhead ? 'ring-2 ring-sky-300' : ''}`}
            style={{ height: `${8 + st.norm * 88}%`, background: `hsl(${hue(mode, st.norm)}, 80%, 55%)`, opacity: i === playhead ? 1 : 0.55 }}
          />
        ))}
      </div>
      {mode === 'climate' && (
        <div className="mt-0.5 flex gap-[2px] text-[9px] text-slate-500">
          {steps.map((st, i) => <div key={i} className="flex-1 truncate text-center">{st.label}</div>)}
        </div>
      )}

      {loading && <p className="mt-2 text-sm text-slate-400">Loading data…</p>}
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      {!loading && !error && !steps.length && <p className="mt-2 text-sm text-slate-500">No data to sonify.</p>}
    </Glass>
  );
}

export default EarthJukebox;
