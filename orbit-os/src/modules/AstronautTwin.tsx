import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';

/* ------------------------------------------------------------------ *
 * Astronaut Digital Twin — a 3D astronaut (three.js primitives, no
 * external model) with a simulated health telemetry overlay and an EVA
 * space-suit console (life-support + integrity test). ALL values are
 * SIMULATED (SAMPLE): they are illustrative physiology/telemetry, never
 * a medical readout or flight-safety claim.
 * ------------------------------------------------------------------ */

interface Vitals { hr: number; spo2: number; temp: number; rad: number; o2: number; co2: number; pressure: number; battery: number }
type SuitState = 'idle' | 'pressurizing' | 'checking' | 'pass' | 'fail';

const VITALS_REF: Vitals = { hr: 72, spo2: 98, temp: 37.0, rad: 0.28, o2: 95, co2: 0.4, pressure: 4.3, battery: 87 };

function buildAstronaut() {
  const astro = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.35, metalness: 0.05 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0xcaa01a, roughness: 0.12, metalness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3240, roughness: 0.5, metalness: 0.1 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.3 });
  const heartMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1 });

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.4, 48, 48), white); helmet.position.y = 1.15;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 32), visorMat); visor.position.set(0, 1.18, 0.26); visor.scale.set(1, 1.1, 0.72);
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 16, 32), dark); neck.position.y = 0.84; neck.rotation.x = Math.PI / 2;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 6, 32), white); torso.position.y = 0.25;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.06), accent); chest.position.set(0, 0.35, 0.42);
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), heartMat); heart.position.set(0.16, 0.38, 0.46);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), dark); pack.position.set(0, 0.4, -0.52);

  const limb = (m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 24), m);
  const joint = (m: THREE.Material) => new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), m);

  const armL = limb(white); armL.position.set(-0.56, 0.35, 0); armL.rotation.z = 0.25;
  const armR = limb(white); armR.position.set(0.56, 0.35, 0); armR.rotation.z = -0.25;
  const legL = limb(white); legL.position.set(-0.18, -0.78, 0);
  const legR = limb(white); legR.position.set(0.18, -0.78, 0);
  const gloveL = joint(accent); gloveL.position.set(-0.75, 0.05, 0);
  const gloveR = joint(accent); gloveR.position.set(0.75, 0.05, 0);
  const bootL = joint(dark); bootL.position.set(-0.18, -1.15, 0);
  const bootR = joint(dark); bootR.position.set(0.18, -1.15, 0);

  astro.add(helmet, visor, neck, torso, chest, heart, pack, armL, armR, legL, legR, gloveL, gloveR, bootL, bootR);
  return { astro, heart, heartMat };
}

export function AstronautTwin() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vitals, setVitals] = useState<Vitals>(VITALS_REF);
  const [suit, setSuit] = useState<SuitState>('idle');
  const hrRef = useRef(72);

  // 3D scene.
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const parent = canvas.parentElement!;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 1.2, 4.4); camera.lookAt(0, 0.3, 0);

    scene.add(new THREE.AmbientLight(0x8899bb, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x66aaff, 1.6); rim.position.set(-3, 1, -2); scene.add(rim);

    const { astro, heart, heartMat } = buildAstronaut();
    scene.add(astro);

    // starfield
    const starPos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) { starPos[i * 3] = (Math.random() - 0.5) * 22; starPos[i * 3 + 1] = (Math.random() - 0.5) * 22; starPos[i * 3 + 2] = (Math.random() - 0.5) * 22; }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.8 })));

    const setSize = () => {
      const w = parent.clientWidth, h = parent.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    setSize();
    const ro = new ResizeObserver(setSize); ro.observe(parent);

    let raf = 0; let t = 0;
    const animate = () => {
      t += 1 / 60;
      astro.rotation.y = Math.sin(t * 0.25) * 0.55;
      astro.position.y = Math.sin(t * 1.1) * 0.035;
      const beat = 60 / hrRef.current;
      const ph = (t % beat) / beat;
      const pulse = ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI) : 0;
      heart.scale.setScalar(0.85 + pulse * 0.5);
      heartMat.emissiveIntensity = 0.6 + pulse * 2.4;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); };
  }, []);

  // simulate live vitals
  useEffect(() => {
    const id = setInterval(() => {
      setVitals((v) => {
        const hr = Math.round(70 + Math.sin(Date.now() / 4000) * 5 + (Math.random() - 0.5) * 3);
        hrRef.current = hr;
        return {
          hr,
          spo2: Math.max(95, Math.min(99, v.spo2 + (Math.random() - 0.5) * 0.4)),
          temp: +(36.7 + Math.sin(Date.now() / 9000) * 0.25 + (Math.random() - 0.5) * 0.1).toFixed(1),
          rad: +(0.26 + Math.random() * 0.04).toFixed(2),
          o2: Math.max(88, v.o2 - 0.02),
          co2: Math.min(1.2, v.co2 + 0.003),
          pressure: suit === 'pressurizing' ? Math.min(4.4, v.pressure + 0.12) : +(4.3 + (Math.random() - 0.5) * 0.02).toFixed(1),
          battery: Math.max(80, v.battery - 0.001),
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [suit]);

  const runSuitTest = () => {
    setSuit('pressurizing');
    setTimeout(() => setSuit('checking'), 2600);
    setTimeout(() => setSuit('pass'), 5200);
  };

  const vitalCard = (label: string, value: string, unit: string, color: string, sub?: string) => (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 p-2 backdrop-blur">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex items-baseline gap-1"><span className="text-lg font-bold" style={{ color }}>{value}</span><span className="text-[10px] text-slate-500">{unit}</span></div>
      {sub && <div className="text-[9px] text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <Glass className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2"><Icon name="HeartPulse" className="h-5 w-5 text-rose-300" /><span className="h-title">Astronaut Digital Twin</span><StatusBadge status="sample" note="simulated physiology · not medical data" /></div>
        <div className="flex gap-2"><Chip className="border-sky-400/30 text-sky-200">3D twin</Chip><Chip className="border-amber-400/30 text-amber-200">EVA suit</Chip></div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* 3D astronaut + overlaid vitals */}
        <div className="relative h-[420px] border-r border-white/10">
          <canvas ref={canvasRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute left-3 top-3 w-40 space-y-1.5">
            {vitalCard('Heart rate', String(vitals.hr), 'BPM', '#fb7185')}
            {vitalCard('SpO₂', vitals.spo2.toFixed(1), '%', '#34d399')}
            {vitalCard('Body temp', vitals.temp.toFixed(1), '°C', '#fbbf24')}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[10px] backdrop-blur">
            <span className="flex items-center gap-1.5"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />crew member · sample telemetry</span>
            <span className="text-slate-400">radiation {vitals.rad.toFixed(2)} mSv/day</span>
          </div>
        </div>

        {/* EVA space-suit console */}
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <div className="h-title">EVA suit · life support</div>
            <StatusBadge status={suit === 'pass' ? 'live' : 'sample'} note={suit === 'pass' ? 'integrity test passed' : 'simulated telemetry'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {vitalCard('O₂ supply', vitals.o2.toFixed(1), '%', '#38bdf8')}
            {vitalCard('CO₂ scrubber', vitals.co2.toFixed(2), '%', '#a78bfa')}
            {vitalCard('Suit pressure', vitals.pressure.toFixed(1), 'psi', '#22d3ee')}
            {vitalCard('Battery', vitals.battery.toFixed(0), '%', '#facc15')}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Suit integrity test</div>
            <div className="mt-1.5 flex items-center gap-2">
              {(['pressurizing', 'checking', 'pass', 'fail'] as SuitState[]).map((s) => {
                const done = suit === 'pass' || suit === 'fail';
                const active = suit === s || (s === 'checking' && suit === 'pass') || (s === 'pressurizing' && (suit === 'checking' || suit === 'pass'));
                const fail = suit === 'fail' && s === 'fail';
                return <div key={s} className={`h-1.5 flex-1 rounded ${active || done ? (fail ? 'bg-rose-500' : 'bg-emerald-400') : 'bg-white/10'}`} />;
              })}
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">
              {suit === 'idle' && 'Pressurise → hold → leak-check. Ready to run.'}
              {suit === 'pressurizing' && 'Pressurising to 4.3 psi…'}
              {suit === 'checking' && 'Holding pressure, checking for leaks…'}
              {suit === 'pass' && '✓ No leak detected — suit integrity nominal.'}
              {suit === 'fail' && '✗ Leak detected — abort EVA.'}
            </div>
            <button className="btn-primary mt-2 w-full !py-1.5 text-xs" onClick={runSuitTest} disabled={suit === 'pressurizing' || suit === 'checking'}>
              <Icon name="Zap" className="h-3.5 w-3.5" />{suit === 'pass' ? 'Re-run integrity test' : 'Run integrity test'}
            </button>
          </div>

          <div className="rounded-lg border border-rose-400/25 bg-rose-500/5 p-2.5 text-[10px] text-rose-100">
            <b>Simulated, not medical.</b> Heart rate, SpO₂, temperature, radiation and suit telemetry are illustrative SAMPLE values — the kernel never diagnoses. Real astronaut health monitoring queues anomalies for a flight surgeon&rsquo;s review (challenge #4).
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default AstronautTwin;
