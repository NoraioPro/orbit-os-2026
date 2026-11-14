import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadEvents, setEventSource, type EventSource, type EventsDB } from '../data/events';
import { pingLive } from '../data/live';
import { llmStatus } from '../investigate/llm';
import type { InvestigationResult } from '../investigate/run';
import { loadReviews, type EvidencePack, type ReviewEntry } from '../kernel';

interface Settings { preferLive: boolean; useLlm: boolean; dataSource: EventSource }
interface Store {
  db: EventsDB | null; dbError: string | null;
  live: boolean | null; llm: { configured: boolean; model: string | null };
  settings: Settings; setSettings: (s: Settings) => void;
  evidence: EvidencePack | null; openEvidence: (e: EvidencePack | null) => void;
  history: InvestigationResult[]; addResult: (r: InvestigationResult) => void;
  reviews: Record<string, ReviewEntry>;
  reports: EvidencePack[]; saveReport: (e: EvidencePack) => void;
}
const Ctx = createContext<Store>(null as unknown as Store);
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<EventsDB | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const [llm, setLlm] = useState({ configured: false, model: null as string | null });
  const [settings, setSettingsS] = useState<Settings>(() => ({ dataSource: 'harvest' as EventSource, ...load('orbit.settings.v2', { preferLive: true, useLlm: true }) }));
  const [evidence, openEvidence] = useState<EvidencePack | null>(null);
  const [history, setHistory] = useState<InvestigationResult[]>(() => load('orbit.history.v1', []));
  const [reviews, setReviews] = useState(loadReviews());
  const [reports, setReports] = useState<EvidencePack[]>(() => load('orbit.reports.v1', []));

  useEffect(() => { setEventSource(settings.dataSource); setDb(null); loadEvents(settings.dataSource).then(setDb).catch((e) => setDbError(String(e.message || e))); }, [settings.dataSource]);
  useEffect(() => { if (settings.preferLive) pingLive().then(setLive); else setLive(false); }, [settings.preferLive]);
  useEffect(() => { llmStatus().then(setLlm); }, []);
  useEffect(() => { const h = () => setReviews(loadReviews()); window.addEventListener('orbit-review', h); return () => window.removeEventListener('orbit-review', h); }, []);

  const setSettings = useCallback((s: Settings) => { setSettingsS(s); localStorage.setItem('orbit.settings.v2', JSON.stringify(s)); }, []);
  const addResult = useCallback((r: InvestigationResult) => setHistory((h) => { const n = [r, ...h].slice(0, 30); localStorage.setItem('orbit.history.v1', JSON.stringify(n)); return n; }), []);
  const saveReport = useCallback((e: EvidencePack) => setReports((h) => { const n = [e, ...h.filter((x) => x.id !== e.id)].slice(0, 50); localStorage.setItem('orbit.reports.v1', JSON.stringify(n)); return n; }), []);

  const v = useMemo(() => ({ db, dbError, live, llm, settings, setSettings, evidence, openEvidence, history, addResult, reviews, reports, saveReport }), [db, dbError, live, llm, settings, setSettings, evidence, history, addResult, reviews, reports, saveReport]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);
