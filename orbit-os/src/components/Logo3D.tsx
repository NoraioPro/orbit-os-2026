import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/** Static fallback if WebGL is unavailable. */
function StaticLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" style={{ width: size, height: size }} aria-hidden="true">
      <defs>
        <radialGradient id="lg3d1" cx=".35" cy=".35"><stop offset="0" stopColor="#7dd3fc" /><stop offset=".6" stopColor="#4f46e5" /><stop offset="1" stopColor="#1e1b4b" /></radialGradient>
        <linearGradient id="lg3d2" x1="0" x2="1"><stop offset="0" stopColor="#f97316" /><stop offset=".5" stopColor="#ec4899" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="15" fill="url(#lg3d1)" />
      <ellipse cx="32" cy="32" rx="29" ry="11" fill="none" stroke="url(#lg3d2)" strokeWidth="4" transform="rotate(-28 32 32)" />
      <circle cx="55" cy="20" r="3" fill="#fde68a" />
    </svg>
  );
}

/**
 * Live 3D ORBIT OS mark: a rotating glowing globe, two tilted orbital rings,
 * an orbiting satellite and a pulsing scan sweep — an animated "secure,
 * live intelligence" system. Lightweight three.js scene, with an SVG fallback.
 */
export function Logo3D({ size = 44 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.4, 6);

    // Globe core — the "intelligence" centre
    const globeGeo = new THREE.SphereGeometry(1.3, 32, 32);
    const globeMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, emissive: 0x1e1b4b, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Wireframe shell — network / awareness
    const wireGeo = new THREE.SphereGeometry(1.33, 20, 20);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.28 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // Tilted orbit plane
    const orbit = new THREE.Group();
    orbit.rotation.x = Math.PI / 2.4;
    orbit.rotation.z = 0.35;
    scene.add(orbit);

    const ringGeo = new THREE.TorusGeometry(2.35, 0.055, 8, 96);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    orbit.add(new THREE.Mesh(ringGeo, ringMat));

    const ring2Geo = new THREE.TorusGeometry(2.0, 0.035, 8, 96);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.85 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = 0.5;
    orbit.add(ring2);

    // Orbiting satellite — the "surveillance" node
    const satGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const satMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const sat = new THREE.Mesh(satGeo, satMat);
    orbit.add(sat);

    // Pulsing scan sweep — "live security"
    const scanGeo = new THREE.TorusGeometry(1.7, 0.015, 6, 64);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 });
    const scan = new THREE.Mesh(scanGeo, scanMat);
    scene.add(scan);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const l1 = new THREE.DirectionalLight(0x7dd3fc, 2.2); l1.position.set(3, 3, 4); scene.add(l1);
    const l2 = new THREE.DirectionalLight(0xf97316, 1.4); l2.position.set(-3, -2, 2); scene.add(l2);

    let raf = 0;
    let t = 0;
    const animate = () => {
      t += 0.012;
      globe.rotation.y += 0.006;
      wire.rotation.y -= 0.004;
      ring2.rotation.z -= 0.010;
      const r = 2.35;
      sat.position.set(Math.cos(t * 1.3) * r, Math.sin(t * 1.3) * r, 0);
      scan.rotation.z = t * 0.8;
      scan.rotation.x = Math.PI / 2.6;
      scanMat.opacity = 0.12 + 0.12 * Math.sin(t * 2);
      globe.scale.setScalar(1 + Math.sin(t * 1.5) * 0.02);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const arr = Array.isArray(m.material) ? m.material : [m.material];
          arr.forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <div ref={ref} style={{ width: size, height: size }} className="shrink-0" aria-hidden="true">
      {failed ? <StaticLogo size={size} /> : null}
    </div>
  );
}
