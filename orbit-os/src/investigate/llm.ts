// Optional LLM. Disabled unless the dev server has ORBIT_LLM_API_KEY. Outputs are validated; numbers come only from the kernel.
import type { EvidencePack } from '../kernel';
import type { InvestigationPlan } from './plan';
import { PLACES, POWER_VARS } from '../data/power';

let status: Promise<{ configured: boolean; model: string | null }> | null = null;
export const llmStatus = () => (status ??= fetch('/api/llm/status').then((r) => (r.ok ? r.json() : { configured: false, model: null })).catch(() => ({ configured: false, model: null })));

async function chat(system: string, user: string) {
  const r = await fetch('/api/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, user }) });
  if (!r.ok) throw new Error('llm failed');
  return (await r.json()).content as string;
}

export async function llmPlan(question: string, base: InvestigationPlan): Promise<Partial<InvestigationPlan> | null> {
  const sys = `You convert questions into a JSON plan for ORBIT OS. Reply with JSON only: {"intent":"trend|events|anomaly|analog|unsupported","variables":[...subset of ${Object.keys(POWER_VARS).join(',')}],"eventType":"earthquake|wildfires|severeStorms|volcanoes|seaLakeIce|null","placeId":"one of ${PLACES.map((p) => p.id).join(',')} or null","lat":number|null,"lon":number|null,"yearFrom":int,"yearTo":int<=2025,"recentYears":int,"days":int<=30}. Never invent datasets.`;
  const txt = await chat(sys, question);
  const j = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
  const intents = ['trend', 'events', 'anomaly', 'analog', 'unsupported'];
  if (!intents.includes(j.intent)) return null;
  const vars = Array.isArray(j.variables) ? j.variables.filter((v: string) => v in POWER_VARS) : base.variables;
  const p = PLACES.find((x) => x.id === j.placeId);
  const place = p ? { name: p.name, lat: p.lat, lon: p.lon, id: p.id, radiusKm: 500 } : Number.isFinite(j.lat) && Number.isFinite(j.lon) && Math.abs(j.lat) <= 90 && Math.abs(j.lon) <= 180 ? { name: `${(+j.lat).toFixed(2)}°, ${(+j.lon).toFixed(2)}°`, lat: +j.lat, lon: +j.lon, radiusKm: 500 } : base.place;
  const clampY = (y: any, d: number) => (Number.isInteger(y) ? Math.max(1981, Math.min(2025, y)) : d);
  return { intent: j.intent, variables: vars.length ? vars : base.variables, eventType: j.eventType || base.eventType, place, yearFrom: clampY(j.yearFrom, base.yearFrom), yearTo: clampY(j.yearTo, base.yearTo), recentYears: Number.isInteger(j.recentYears) ? j.recentYears : base.recentYears, days: Number.isInteger(j.days) ? Math.min(30, Math.max(1, j.days)) : base.days };
}

export async function llmNarrate(question: string, e: EvidencePack) {
  const sys = 'You are ORBIT, a careful Earth-science analyst. Write 2-3 sentences answering the question using ONLY the numbers given. Keep each [status] label next to its number. State the confidence level. Do not add facts, forecasts or advice.';
  const user = `Question: ${question}\nTitle: ${e.title}\nWindow: ${e.window.start}–${e.window.end}\nMetrics:\n${e.metrics.map((m) => `- ${m.label}: ${m.value} [${m.status}]`).join('\n')}\nConfidence: ${e.confidence.level} (${e.confidence.rationale})\nLimitations: ${e.limitations.join(' ')}`;
  const out = await chat(sys, user);
  return out.trim() || null;
}
