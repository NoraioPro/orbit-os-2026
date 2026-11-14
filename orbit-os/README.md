# ORBIT OS · Space Intelligence Platform

**NASA Space Apps 2026 · "One Change Engine, Many Worlds"**

ORBIT OS is one platform instead of 14 separate hackathon apps. Every challenge in the set is one of **six problems in disguise**. ORBIT implements those six once, as a shared **kernel**, and every module calls the same functions. Earth data validates the methods, and the Moon and Mars reuse them.

The lead module is **ORBIT Earth Pulse** (Earth System Trend Detective). It bundles challenges 2, 5, 6, 8 and 14 on NASA POWER, EONET, FIRMS and GIBS. GISTEMP, GPM, SMAP, MODIS/VIIRS values, HLS and NISAR are planned and shown as "not connected". Challenge 7 (ISS microgravity combustion) is **deliberately not merged** with Earth fire data.

## Quick start (Windows, macOS, Linux · Node 20+, tested on 22/24)

```bash
cd orbit-os
npm install
npm run dev          # http://localhost:5173
```

The repo already contains the derived data, so the app runs **offline**. When the network is available, live keyless APIs (NASA POWER, NASA EONET, USGS FDSN, NASA GIBS tiles) are used, and the badge in the top right turns **Live**.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (+ optional LLM proxy at `/api/llm`) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm test` | Kernel self-test (the six patterns) |
| `npm run data:live` | Rebuild `public/data/live/*` from `../data-collector/out` (or `ORBIT_COLLECTOR_OUT=…`) |
| `npm run data:shards -- <dir>` | Rebuild `public/data/events.json` from the 86 shards (`06_data-shards`) |
| `npm run data:power` | Re-fetch the 2001–2025 NASA POWER monthly snapshot for the 27-place gazetteer |
| `npm run assets` | Copy the generated asset pack (`../assets` or `ORBIT_ASSETS_DIR`) into `public/assets` |

### Optional LLM

Copy `.env.example` to `.env` and set `ORBIT_LLM_API_KEY` (any OpenAI-compatible endpoint via `ORBIT_LLM_BASE_URL` and `ORBIT_LLM_MODEL`). The key stays on the Vite dev server and is never sent to the browser. The LLM may only **plan** (its JSON is validated) and **narrate** (using only kernel numbers). Without a key, a deterministic planner and narrator are used. `.env` is git-ignored.

## Repository layout (shared repo with the collector)

```
<repo>/
├── data-collector/        # harvests live sources -> out/*.json + manifest.json (not modified by the app)
└── orbit-os/              # this app
    ├── public/data/
    │   ├── events.json             # 17,186-record shard snapshot (USGS + EONET, 2026-11-14 11:39 UTC)
    │   ├── power-snapshot.json     # NASA POWER monthly 2001–2025, 27 places
    │   └── live/                   # derived from data-collector/out by `npm run data:live`
    │       ├── events.json         # EONET + USGS M2.5+ (10,111 records)
    │       ├── firms-grid.json     # 123,889 FIRMS detections -> 1° cells + 400 hottest
    │       ├── power-monthly.json  # 14 points × 5 y daily -> monthly means
    │       ├── space.json          # SWPC Kp + solar wind, DONKI CMEs, Celestrak sample
    │       ├── gibs-layers.json    # 13 GIBS WMTS layers for the globe
    │       └── manifest.json       # collector provenance
    ├── public/prototypes/          # the 14 challenge prototypes (sample data), embedded on module pages
    ├── public/assets/              # asset pack (logo, hero, module images, narration); placeholder manifest
    ├── scripts/                    # data builders, asset sync, kernel self-test
    └── src/
        ├── kernel/                 # THE SIX PATTERNS (pure TS, no UI)
        ├── data/                   # loaders, connectors, catalog, module registry
        ├── investigate/            # Quick Investigation: plan.ts, run.ts, llm.ts
        ├── components/             # globe, evidence drawer, charts, layout
        ├── modules/                # per-module widgets
        └── pages/                  # Command Center, Analysis, module pages, hub pages
```

A suggested root `.gitignore` is in `docs/repo-root.gitignore`. It ignores every `.env*` except `.env.example` and the two large raw collector files.

## Architecture

**Kernel (`src/kernel`)**: six patterns, each a small, tested function set.

| Pattern | File | Methods |
| --- | --- | --- |
| Change over time | `change.ts` | Annual means, Theil-Sen, OLS, Mann-Kendall, window-vs-baseline |
| Anomaly / intent | `anomaly.ts` | PRD DG-04 cell rule (7 d vs prev. 7 d, ≥2× and ≥+5 per 2° cell), Poisson tail, z-scores |
| Scarce-resource planning | `planning.ts` | Exact 0/1 knapsack (DP) or greedy, energy-aware A* |
| Sensor fusion | `fusion.ts` | Quality-weighted support, agreement, coverage → confidence. Sample data down-weighted |
| Human review | `review.ts` | Every flag lands in a review queue: confirm, dismiss or escalate, with a note |
| Earth analog → Moon/Mars | `transfer.ts` | Similarity of Earth sites to world profiles (cold, aridity, light) |

**Evidence & Anomaly Fabric**: every globe point, flag, callout, chart and investigation opens an **evidence pack** (`EvidencePack` in `kernel/types.ts`). It shows the metrics (each with its own status), the series chart (with a "Listen" sonification button from challenge 14), sources with retrieval times, the time window, confidence and its rationale, the method, limitations, the underlying records, the kernel patterns used, and review controls. Packs can be saved to Reports (Markdown export) or downloaded as JSON.

**Data honesty**: every figure carries `live`, `snapshot` or `sample`. Collector data is labelled **`live (harvested 14 Nov 2026 14:06 Oslo)`**, computed from `manifest.collected_at`. Planned connectors never produce numbers. Synthetic demos (InSAR grid, GNSS trace, routes, outpost, crew HR) are stamped SAMPLE and use a seeded generator. Command Center KPIs are app-registry counts and are labelled as such.

**Quick Investigation**: question → `deterministicPlan` (gazetteer, time phrases, intent and variable keywords) → optional LLM plan, validated → `run.ts` executes kernel steps with live-first connectors and snapshot fallback → evidence pack + narrative → review queue. Intents: `trend`, `events`, `anomaly`, `analog`, `unsupported`.

**Globe**: react-globe.gl (three.js). It shows 1° event cells, FIRMS fire cells, pulsing DG-04 rings and screen-space insight callouts. The imagery switcher offers bundled Blue Marble or any of the 13 **NASA GIBS** WMTS layers (true colour, SST, snow/ice, NDVI) through the tile engine. True-colour layers use the previous full day.

## 3-minute demo script

1. **0:00 Command Center.** "Fourteen challenges, six patterns, one engine." Point at the globe: event cells, yellow FIRMS fire cells and pulsing anomaly rings. Every badge says live, snapshot or sample.
2. **0:30 Click "Fire hotspot (FIRMS)".** The globe flies there and the evidence pack opens: 24-hour detections, FRP, sources, confidence rationale and limitations. Press **Confirm** so a human signs off. Close it, then click **Wildfire surge** to show the DG-04 week-on-week rule with its daily bars.
3. **1:10 Quick Investigation.** Type *"Show vegetation change in Norway last 5 years"* → Analyze. Show the structured plan. ORBIT says honestly that no NDVI number is connected, so it **fuses** soil wetness, temperature and precipitation from NASA POWER (live) with a Mann-Kendall test. Open the evidence pack and press **Listen**.
4. **1:50 Earth Intelligence.** Switch place and variable. The 25-year trend is followed by the 5-year daily harvest panel (last 12 months vs earlier, deseasonalised).
5. **2:15 Explore.** Switch the globe imagery to GIBS NDVI or SST, which are live tiles.
6. **2:35 Missions → Space Explorer.** The same kernel ranks Earth analogs for Mars and the Moon. Space weather (Kp, CMEs) and the Celestrak sample are shown as live harvest. Autonomy Lab runs the same A* planner on Svalbard and on Mars.
7. **2:55 Close.** "Prove it on Earth, ship it to the Moon and Mars. Every number has a source."

## Known gaps

- No NDVI, SST, SMAP, GISTEMP, GPM, HLS or NISAR **values** yet. GIBS NDVI and SST appear as imagery only.
- FIRMS covers 24 hours only, so it shows intensity rather than week-on-week change.
- The harvest is a point-in-time pull. Re-run the collector, then `npm run data:live`.
- GNSS, InSAR, routing, outpost and crew-health demos use sample data.
- Reviews, history and reports are stored in browser localStorage, with no multi-user backend.
- Bundle is about 2.3 MB (three.js + globe.gl). Code-splitting is a follow-up.
