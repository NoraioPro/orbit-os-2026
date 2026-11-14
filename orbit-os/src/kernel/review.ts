// Pattern 5: HUMAN REVIEW. Every flag is a proposal until a person decides.
export type ReviewState = 'pending' | 'confirmed' | 'dismissed' | 'escalated';
export interface ReviewEntry { id: string; state: ReviewState; note: string; at: string }

const KEY = 'orbit.review.v1';
export function loadReviews(): Record<string, ReviewEntry> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
export function saveReview(e: ReviewEntry) {
  const all = loadReviews();
  all[e.id] = e;
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('orbit-review'));
  return all;
}
