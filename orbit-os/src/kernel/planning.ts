// Pattern 3: SCARCE-RESOURCE PLANNING
export interface PlanItem { id: string; name: string; cost: number; value: number }

/** Budgeted allocation: greedy by value/cost, then a tiny exact DP when small enough. */
export function allocate(items: PlanItem[], budget: number) {
  const n = items.length;
  if (n <= 20 && budget <= 2000 && items.every((i) => Number.isInteger(i.cost))) {
    const dp = Array.from({ length: n + 1 }, () => new Array(budget + 1).fill(0));
    for (let i = 1; i <= n; i++) for (let b = 0; b <= budget; b++) {
      dp[i][b] = dp[i - 1][b];
      const it = items[i - 1];
      if (it.cost <= b) dp[i][b] = Math.max(dp[i][b], dp[i - 1][b - it.cost] + it.value);
    }
    const chosen: PlanItem[] = [];
    let b = budget;
    for (let i = n; i > 0; i--) if (dp[i][b] !== dp[i - 1][b]) { chosen.push(items[i - 1]); b -= items[i - 1].cost; }
    return { chosen: chosen.reverse(), used: budget - b, value: dp[n][budget], method: 'exact 0/1 knapsack (DP)' };
  }
  const sorted = [...items].sort((a, b) => b.value / b.cost - a.value / a.cost);
  const chosen: PlanItem[] = [];
  let used = 0, value = 0;
  for (const it of sorted) if (used + it.cost <= budget) { chosen.push(it); used += it.cost; value += it.value; }
  return { chosen, used, value, method: 'greedy value/cost' };
}

/** Energy-aware A* on a cost grid. cost[r][c] = traversal cost (Infinity = blocked). */
export function routePlan(cost: number[][], start: [number, number], goal: [number, number]) {
  const R = cost.length, C = cost[0].length;
  const key = (r: number, c: number) => r * C + c;
  const g = new Map<number, number>([[key(...start), 0]]);
  const came = new Map<number, number>();
  const open: [number, number, number][] = [[0, ...start]];
  const h = (r: number, c: number) => Math.hypot(r - goal[0], c - goal[1]);
  const seen = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, r, c] = open.shift()!;
    const k = key(r, c);
    if (seen.has(k)) continue;
    seen.add(k);
    if (r === goal[0] && c === goal[1]) break;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C || !Number.isFinite(cost[nr][nc])) continue;
      const ng = g.get(k)! + cost[nr][nc] * Math.hypot(dr, dc);
      const nk = key(nr, nc);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, k); open.push([ng + h(nr, nc), nr, nc]); }
    }
  }
  const path: [number, number][] = [];
  let cur: number | undefined = key(...goal);
  if (!g.has(cur)) return { path, energy: Infinity };
  while (cur !== undefined) { path.unshift([Math.floor(cur / C), cur % C]); cur = came.get(cur); }
  return { path, energy: g.get(key(...goal))! };
}
