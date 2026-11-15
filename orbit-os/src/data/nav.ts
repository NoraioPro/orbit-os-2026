import { CHALLENGES, MODULES } from './modules';
import { CHALLENGE_META } from './challenges';

/**
 * ORBIT's single navigation registry.
 *
 * ONE source of truth. The left spine AND the command palette both read from
 * here, so a destination can never appear in one and be missing from the other
 * (that duplication is exactly what the old 9-pill top nav + 14-row sidebar did).
 *
 * Add a destination by adding it to a group here — do not add a second nav.
 */

export type NavGroupId = 'command' | 'worlds' | 'intelligence' | 'program' | 'system';

export interface NavItem {
  /** stable id, also used as the palette key */
  id: string;
  label: string;
  to: string;
  icon: string;
  kind: 'page' | 'module';
  group: NavGroupId;
  /** short right-aligned marker, e.g. P0 / P1 */
  badge?: string;
  /** one line shown in the palette under the label */
  hint?: string;
  /** extra search terms (module ids, synonyms) */
  keywords?: string[];
  /** accent class for the icon */
  color?: string;
  /** second-level destinations rendered under this row (e.g. the 14 challenge prototypes) */
  children?: NavItem[];
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  /** shown as the group's own subtitle in the rail */
  hint: string;
  items: NavItem[];
}

export const MODULE_COLORS: Record<string, string> = {
  earth: 'text-sky-300', disaster: 'text-orange-400', agri: 'text-lime-400',
  ocean: 'text-cyan-300', infrastructure: 'text-blue-300', gnss: 'text-violet-300',
  autonomy: 'text-fuchsia-300', explorer: 'text-indigo-300', academy: 'text-amber-300',
  human: 'text-slate-200', ignis: 'text-orange-300', sar: 'text-teal-300', defense: 'text-rose-300',
};

/** demo-critical order: P0 first, then P1, honesty-heavy modules last */
export const MODULE_ORDER: string[] = [
  'earth', 'sar', 'disaster', 'defense', 'agri', 'ocean', 'ignis',
  'infrastructure', 'gnss', 'explorer', 'autonomy', 'academy', 'human',
];

/** demo-language topics: the words a judge or Hassan actually types */
export const MODULE_TOPICS: Record<string, string[]> = {
  earth: ['trend', 'warming', 'temperature', 'climate', 'ndvi', 'vegetation', 'imagery', 'gibs', 'power', 'change'],
  disaster: ['flood', 'floods', 'earthquake', 'quake', 'volcano', 'storm', 'wildfire', 'fires', 'anomaly', 'flag', 'events', 'hazard'],
  agri: ['soil', 'drought', 'moisture', 'crop', 'rainfall', 'field', 'water budget', 'sahel', 'farm'],
  ocean: ['sea', 'sst', 'marine', 'atlantic', 'ice', 'ocean colour', 'marine heat'],
  infrastructure: ['city', 'bridge', 'subsidence', 'deformation', 'asset', 'tokyo', 'seismic'],
  gnss: ['gps', 'jamming', 'spoof', 'signal', 'integrity', 'nmea', 'interference', 'navigation'],
  autonomy: ['rover', 'drone', 'route', 'planner', 'energy', 'mars', 'svalbard'],
  explorer: ['analog', 'analogue', 'mars', 'moon', 'site', 'ranking', 'transfer'],
  academy: ['learn', 'outpost', 'budget', 'education', 'game', 'design'],
  human: ['crew', 'astronaut', 'health', 'hr', 'physiology', 'iss'],
  ignis: ['flame', 'combustion', 'saffire', 'luci', 'microgravity', 'psi', 'fire in space'],
  sar: ['radar', 'insar', 'coherence', 'backscatter', 'displacement', 'sentinel', 'nisar', 'before after'],
  defense: ['satellite', 'situation room', 'crisis', 'swarm', 'space weather', 'tle', 'situation'],
};

const moduleItems: NavItem[] = MODULE_ORDER
  .map((id) => MODULES.find((m) => m.id === id))
  .filter((m): m is (typeof MODULES)[number] => Boolean(m))
  .map((m) => ({
    id: `module.${m.id}`,
    label: m.name,
    to: `/module/${m.id}`,
    icon: m.icon,
    kind: 'module' as const,
    group: 'worlds' as const,
    badge: m.release,
    hint: m.tagline,
    keywords: [m.id, ...m.patterns, ...m.sdgs.map(String), ...m.datasets, ...(MODULE_TOPICS[m.id] ?? []), ...m.question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)],
    color: MODULE_COLORS[m.id],
  }));

/** per-challenge rail icons (lucide names that already exist in components/ui.tsx) */
const SOLUTION_ICONS: Record<number, string> = {
  1: 'Box', 2: 'ChartColumn', 3: 'Gamepad2', 4: 'HeartPulse', 5: 'Radio', 6: 'Sprout', 7: 'Flame',
  8: 'Clock', 9: 'Target', 10: 'Mars', 11: 'Moon', 12: 'Sparkles', 13: 'Rocket', 14: 'Music',
};

/** the 14 challenge prototypes, as second-level rows under Program › Solutions */
export const SOLUTION_ITEMS: NavItem[] = CHALLENGES.map((c) => {
  const meta = CHALLENGE_META[c.n];
  return {
    id: `solution.${c.n}`,
    label: c.name,
    to: `/solution/${c.n}`,
    icon: SOLUTION_ICONS[c.n] ?? 'Puzzle',
    kind: 'page' as const,
    group: 'program' as const,
    badge: `C${c.n}`,
    hint: meta?.desc,
    keywords: ['challenge', 'solution', 'prototype', `challenge ${c.n}`, ...(meta?.subjects ?? []), ...(meta?.difficulty ? [meta.difficulty] : [])],
  };
});

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Command',
    hint: 'where you start',
    items: [
      {
        id: 'page.center', label: 'Command Center', to: '/', icon: 'LayoutDashboard',
        kind: 'page', group: 'command', hint: 'One change engine, many worlds',
        keywords: ['dashboard', 'home', 'overview', 'start'],
      },
    ],
  },
  {
    id: 'worlds', label: 'Worlds', hint: `${moduleItems.length} solution modules`, items: moduleItems,
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    hint: 'evidence surfaces',
    items: [
      { id: 'page.explore', label: 'Explore', to: '/explore', icon: 'Compass', kind: 'page', group: 'intelligence', hint: 'Worlds, layers and entry points', keywords: ['map', 'layers'] },
      { id: 'page.analysis', label: 'Analysis', to: '/analysis', icon: 'ChartColumn', kind: 'page', group: 'intelligence', hint: 'Ask in plain language — plan, fetch, evidence', keywords: ['ask', 'question', 'query', 'trend'] },
      { id: 'page.unified', label: 'Unified Earth', to: '/unified', icon: 'Layers', kind: 'page', group: 'intelligence', hint: 'Agri × ocean in one geospatial view', keywords: ['unified', 'agri', 'ocean', 'soil moisture', 'sst', 'chlorophyll', 'geospatial', 'combined'] },
      { id: 'page.twin', label: 'Digital Twin', to: '/twin', icon: 'Globe2', kind: 'page', group: 'intelligence', hint: 'The 3D Earth twin', keywords: ['globe', 'earth', '3d'] },
      { id: 'page.earthdata', label: 'Earthdata', to: '/earthdata', icon: 'Earth', kind: 'page', group: 'intelligence', hint: 'Earthdata to evidence: the access path', keywords: ['nasa', 'cmr', 'asf', 'nisar', 'connector'] },
      { id: 'page.data', label: 'Data Hub', to: '/data', icon: 'Database', kind: 'page', group: 'intelligence', hint: 'Every dataset, its status and coverage', keywords: ['datasets', 'sources', 'provenance', 'export', 'csv', 'json'] },
    ],
  },
  {
    id: 'program',
    label: 'Program',
    hint: 'missions & reports',
    items: [
      { id: 'page.missions', label: 'Missions', to: '/missions', icon: 'Rocket', kind: 'page', group: 'program', hint: 'Mission designs and the 14 challenge solutions', keywords: ['challenge', 'space apps'] },
      { id: 'page.solutions', label: 'Solutions', to: '/solutions', icon: 'Puzzle', kind: 'page', group: 'program', hint: 'The 14 published challenge solutions', keywords: ['challenge', 'entries'], children: SOLUTION_ITEMS },
      { id: 'page.sdgs', label: 'SDGs', to: '/sdgs', icon: 'Target', kind: 'page', group: 'program', hint: 'Modules mapped to UN goals', keywords: ['un', 'goals', 'impact'] },
      { id: 'page.reports', label: 'Reports', to: '/reports', icon: 'FileText', kind: 'page', group: 'program', hint: 'Generated evidence reports', keywords: ['pdf', 'export', 'evidence'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    hint: 'agents & config',
    items: [
      { id: 'page.agents', label: 'AI Agents', to: '/agents', icon: 'BrainCircuit', kind: 'page', group: 'system', hint: '7 deterministic agents behind every answer', keywords: ['agents', 'pipeline', 'kernel'] },
      { id: 'page.settings', label: 'Settings', to: '/settings', icon: 'Settings', kind: 'page', group: 'system', hint: 'Live mode, snapshot, connectors', keywords: ['config', 'live', 'snapshot'] },
    ],
  },
];

/** flattened (children included) — the palette iterates this, the rail iterates NAV_GROUPS */
export const NAV_INDEX: NavItem[] = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => (i.children ? [i, ...i.children] : [i])));

/** resolve the current location to a nav item (module routes included) */
export function matchNav(pathname: string): { group?: NavGroup; item?: NavItem } {
  const path = pathname.replace(/\/+$/, '') || '/';
  const item = NAV_INDEX.find((i) => i.to === path);
  if (item) return { group: NAV_GROUPS.find((g) => g.id === item.group), item };
  if (path.startsWith('/module/')) {
    const id = path.slice('/module/'.length);
    const mod = NAV_INDEX.find((i) => i.to === `/module/${id}`);
    if (mod) return { group: NAV_GROUPS.find((g) => g.id === mod.group), item: mod };
  }
  return {};
}

/** extras that are reachable but hidden from the spine (alias routes, deep pages) */
export const NAV_EXTRAS: NavItem[] = [
  { id: 'page.arctic', label: 'Arctic Watch', to: '/arctic', icon: 'Snowflake', kind: 'page', group: 'worlds', hint: 'ORBIT OS · Arctic Watch (embedded sibling app)', keywords: ['ice', 'svalbard', 'arctic'] },
];

/** punctuation/space-insensitive substring match, scored by where it hits */
export function fuzzyScore(query: string, item: NavItem): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = `${item.label} ${item.hint ?? ''} ${(item.keywords ?? []).join(' ')} ${item.to}`.toLowerCase();
  const label = item.label.toLowerCase();
  if (label.startsWith(q)) return 100;
  if (label.includes(q)) return 80;
  if ((item.keywords ?? []).some((k) => k.toLowerCase().startsWith(q))) return 60;
  if (hay.includes(q)) return 40;
  // token-by-token: every token must appear somewhere
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => hay.includes(t))) return 30;
  // loose subsequence on the label
  let i = 0;
  for (const ch of label) if (ch === q[i]) i++;
  return i === q.length && q.length > 2 ? 10 : 0;
}

export function searchNav(query: string, limit = 9): NavItem[] {
  return [...NAV_INDEX, ...NAV_EXTRAS]
    .map((item) => ({ item, score: fuzzyScore(query, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((r) => r.item);
}
