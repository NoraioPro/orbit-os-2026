/** Data status. Every figure in ORBIT OS carries one of these (PRD DATA-01). */
export type DataStatus = 'sample' | 'snapshot' | 'live';

export type PatternId = 'change' | 'anomaly' | 'planning' | 'fusion' | 'review' | 'transfer';

export interface SourceRef {
  name: string;
  url?: string;
  retrieved?: string; // ISO timestamp
}

export interface Confidence {
  level: 'low' | 'medium' | 'high';
  score: number; // 0..1
  rationale: string;
}

export interface SeriesPoint { x: number; y: number | null }

export interface EvidencePack {
  id: string;
  title: string;
  subtitle?: string;
  kind: 'anomaly' | 'trend' | 'event' | 'investigation' | 'plan' | 'transfer' | 'fusion';
  status: DataStatus;
  /** Human label for the status, e.g. 'live (harvested 14 Nov 2026 14:06 Oslo)'. */
  statusLabel?: string;
  sources: SourceRef[];
  window: { start: string; end: string; label?: string };
  location?: { name: string; lat?: number; lon?: number; radiusKm?: number };
  confidence: Confidence;
  method: string;
  metrics: { label: string; value: string; status: DataStatus }[];
  series?: { label: string; unit: string; points: SeriesPoint[]; trend?: { slope: number; intercept: number } };
  records?: { id: string; title: string; time: string; value?: string; url?: string }[];
  limitations: string[];
  patterns: PatternId[];
  createdAt: string;
}

export const PATTERNS: Record<PatternId, { name: string; short: string; description: string }> = {
  change: { name: 'Change over time', short: 'Change', description: 'Annualise a series, fit Theil-Sen and OLS slopes, Mann-Kendall significance, window-vs-baseline deltas.' },
  anomaly: { name: 'Anomaly / intent detection', short: 'Anomaly', description: 'Fixed-window count rule per 2° cell (DG-04), Poisson tail test, z-score outliers in series.' },
  planning: { name: 'Scarce-resource planning', short: 'Planning', description: 'Budgeted allocation (value/cost greedy) and energy-limited A* routing.' },
  fusion: { name: 'Sensor fusion', short: 'Fusion', description: 'Combine independent indicators into one confidence with agreement and coverage weighting.' },
  review: { name: 'Human review', short: 'Review', description: 'Every flag lands in a review queue: confirm, dismiss or escalate, with a note. Nothing auto-publishes.' },
  transfer: { name: 'Earth analog → Moon/Mars', short: 'Transfer', description: 'Score Earth sites against a target world profile, then reuse the same Earth-tested pipeline off-world.' },
};
