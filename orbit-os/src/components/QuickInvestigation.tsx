import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Glass, Icon } from './ui';

export function QuickInvestigation({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const go = (text: string) => nav(`/analysis?q=${encodeURIComponent(text || 'Show vegetation change in Norway last 5 years')}`);
  return (
    <Glass className={`border-violet-400/30 p-4 ${compact ? '' : 'shadow-glow-violet'}`}>
      <div className="flex items-center gap-2"><Icon name="Zap" className="h-5 w-5 text-violet-300" /><div className="h-title">Quick Investigation</div></div>
      <p className="mt-0.5 text-xs text-slate-400">Ask in plain language. ORBIT plans, fetches and shows the evidence.</p>
      <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }}>
        <input aria-label="Investigation question" className="input !text-xs" placeholder="e.g., Show vegetation change in Norway last 5 years" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary w-full justify-center" type="submit">Analyze <Icon name="ArrowRight" /></button>
      </form>
    </Glass>
  );
}
