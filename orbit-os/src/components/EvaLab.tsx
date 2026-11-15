import { Chip, Glass, Icon, StatusBadge } from './ui';

/**
 * NORGE EVA · Build Lab — the interactive suit artifact, embedded.
 *
 * The artifact is a self-contained HTML (its own geometry, textures and three.js
 * from a CDN) served from /artifacts/. It is rendered in an iframe so its
 * animation loop and WebGL context stay isolated from ORBIT's own globe: two
 * renderers in one document fight over the GPU and frame budget.
 *
 * Honesty: this panel shows a 3D suit you can open, explode, pose and light. It
 * makes no physiological claim — the simulated crew telemetry lives in its own
 * panel below and says it is simulated.
 */

export function EvaLab({ height = 760 }: { height?: number }) {
  return (
    <Glass className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sky-300/25 bg-sky-500/10 text-sky-300">
            <Icon name="Bot" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-white">NORGE EVA · Build Lab</span>
              <StatusBadge status="live" note="local artifact" />
            </div>
            <p className="truncate text-[10px] text-slate-400">
              Interactive suit model — open it up, explode the layers, pose it and light the scene. Rendered locally, no network dependency beyond the three.js CDN.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip><Icon name="Cpu" className="h-3 w-3" /> WebGL</Chip>
          <a
            href="/artifacts/norge-eva-build-lab.html"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !px-2.5 !py-1 text-[11px]"
          >
            Open full screen ↗
          </a>
        </div>
      </div>

      <div className="relative bg-[#05070c]">
        <iframe
          src="/artifacts/norge-eva-build-lab.html"
          title="NORGE EVA · Build Lab — interactive suit"
          className="block w-full border-0 bg-[#05070c]"
          style={{ height }}
          allow="fullscreen; xr-spatial-tracking"
          loading="lazy"
        />
      </div>

      <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-slate-500">
        Artifact: NORGE EVA build lab (local HTML). The suit, its layer controls and the motion presets are the artifact’s own; ORBIT adds no
        numbers to it — anything physiological stays in the simulated-telemetry panel and is labelled as simulated.
      </div>
    </Glass>
  );
}
