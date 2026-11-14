// Pattern 4: SENSOR FUSION
export interface Indicator { name: string; signal: number /* -1..1, + supports the hypothesis */; quality: number /* 0..1 */; status: 'sample' | 'snapshot' | 'live' }

/** Quality-weighted fusion. Agreement between indicators raises confidence; sample data is down-weighted. */
export function fuse(indicators: Indicator[]) {
  if (!indicators.length) return { support: 0, agreement: 0, confidence: 0, level: 'low' as const };
  const w = indicators.map((i) => i.quality * (i.status === 'sample' ? 0.4 : 1));
  const W = w.reduce((a, b) => a + b, 0) || 1;
  const support = indicators.reduce((s, i, k) => s + i.signal * w[k], 0) / W;
  const signs = indicators.map((i) => Math.sign(i.signal));
  const dom = Math.sign(support) || 1;
  const agreement = signs.filter((s) => s === dom).length / indicators.length;
  const coverage = Math.min(1, W / 3);
  const confidence = Math.min(0.95, Math.abs(support) * 0.5 + agreement * 0.3 + coverage * 0.2);
  const level = confidence >= 0.7 ? 'high' : confidence >= 0.45 ? 'medium' : 'low';
  return { support, agreement, confidence, level: level as 'low' | 'medium' | 'high' };
}
