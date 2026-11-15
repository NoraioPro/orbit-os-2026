import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GlobeProject } from './OrbitGlobe';

/**
 * Connector lines between a globe and the list that describes its spots.
 *
 * Both the pin position (projected from lat/lng every frame, so it tracks a
 * rotating globe) and the anchor position (a DOM row) are measured relative to
 * one positioned container, which keeps the SVG trivial: no scroll math, no
 * per-page coordinate systems.
 */

export interface ConnectorPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  /** 1 = full strength, lower fades (used for "selected vs the rest") */
  weight?: number;
}
export interface ConnectorPin {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  weight: number;
}
export interface ConnectorAnchor {
  id: string;
  x: number;
  y: number;
  color: string;
  weight: number;
}

export function useGlobeConnectors(opts: {
  project: GlobeProject | null;
  points: ConnectorPoint[];
  /** positioned wrapper the SVG overlays */
  containerRef: RefObject<HTMLElement | null>;
  /** element whose box the projector's pixels are relative to */
  globeRectRef: RefObject<HTMLElement | null>;
  /** live lookup of the DOM row each point connects to */
  anchorEls: () => Map<string, HTMLElement | null>;
  intervalMs?: number;
}): { pins: ConnectorPin[]; anchors: ConnectorAnchor[] } {
  const { project, points, containerRef, globeRectRef, anchorEls, intervalMs = 420 } = opts;
  const [pins, setPins] = useState<ConnectorPin[]>([]);
  const [anchors, setAnchors] = useState<ConnectorAnchor[]>([]);
  const key = points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.weight ?? 1}`).join('|');
  // keep the latest inputs in refs: the polling effect must not restart on every
  // render (new array identities would otherwise loop setState -> render -> effect)
  const pointsRef = useRef(points);
  const anchorElsRef = useRef(anchorEls);
  pointsRef.current = points;
  anchorElsRef.current = anchorEls;

  useEffect(() => {
    if (!project) return;
    let stopped = false;
    let timer = 0;
    const tick = () => {
      if (stopped) return;
      const box = containerRef.current?.getBoundingClientRect();
      const globe = globeRectRef.current?.getBoundingClientRect();
      if (box && globe) {
        const nextPins: ConnectorPin[] = [];
        for (const p of pointsRef.current) {
          const projected = project(p.lat, p.lng);
          if (!projected) continue;
          const x = globe.left - box.left + projected.x;
          const y = globe.top - box.top + projected.y;
          if (x < -40 || y < -40 || x > box.width + 40 || y > box.height + 40) continue;
          nextPins.push({ id: p.id, x, y, color: p.color, label: p.label, weight: p.weight ?? 1 });
        }
        setPins(nextPins);

        const els = anchorElsRef.current();
        const nextAnchors: ConnectorAnchor[] = [];
        for (const p of pointsRef.current) {
          const el = els.get(p.id);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          nextAnchors.push({ id: p.id, x: r.left - box.left, y: r.top - box.top + r.height / 2, color: p.color, weight: p.weight ?? 1 });
        }
        setAnchors(nextAnchors);
      }
      timer = window.setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // `key` captures point identity/labels; the arrays themselves are read via refs
  }, [project, key, intervalMs, containerRef, globeRectRef]);

  return { pins, anchors };
}

/** The overlay itself — absolutely positioned, never intercepts the pointer. */
export function ConnectorLines({ pins, anchors, showLabels = true, labelMinWeight = 0.75 }: { pins: ConnectorPin[]; anchors: ConnectorAnchor[]; showLabels?: boolean; labelMinWeight?: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden="true">
      {pins.map((pin) => {
        const anchor = anchors.find((a) => a.id === pin.id);
        if (!anchor) return null;
        const mx = (pin.x + anchor.x) / 2;
        const d = `M${pin.x},${pin.y} C ${mx},${pin.y} ${mx},${anchor.y} ${anchor.x},${anchor.y}`;
        const w = Math.max(0.35, Math.min(1, pin.weight));
        return (
          <g key={pin.id} opacity={w}>
            <path d={d} fill="none" stroke={pin.color} strokeOpacity="0.2" strokeWidth="5" strokeLinecap="round" />
            <path d={d} fill="none" stroke={pin.color} strokeOpacity={pin.weight >= 1 ? 0.9 : 0.5} strokeWidth={pin.weight >= 1 ? 1.7 : 1.1} strokeLinecap="round" className="connector-flow" />
            <circle cx={pin.x} cy={pin.y} r={pin.weight >= 1 ? 4 : 3} fill={pin.color} stroke="#02040d" strokeWidth="1.2" />
            {pin.weight >= 1 && <circle cx={pin.x} cy={pin.y} r="9" fill="none" stroke={pin.color} strokeOpacity="0.65" className="connector-pulse" />}
            <circle cx={anchor.x} cy={anchor.y} r="2.8" fill={pin.color} stroke="#02040d" strokeWidth="1" />
            {showLabels && pin.weight >= labelMinWeight && (
              <g>
                <rect x={pin.x + 8} y={pin.y - 18} width={Math.max(54, pin.label.length * 4.9)} height="13" rx="4" fill="#02040d" fillOpacity="0.85" stroke={pin.color} strokeOpacity="0.45" />
                <text x={pin.x + 13} y={pin.y - 8} fontSize="9" fill="#f1f5f9">{pin.label}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
