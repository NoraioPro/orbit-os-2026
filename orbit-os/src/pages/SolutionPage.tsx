import { useNavigate, useParams } from 'react-router-dom';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { CHALLENGES, MODULES } from '../data/modules';
import { CHALLENGE_META } from '../data/challenges';

/** Professional sub-page for one challenge prototype: the sample demo + the ORBIT module that implements it. */
export default function SolutionPage() {
  const { n = '1' } = useParams();
  const nav = useNavigate();
  const num = parseInt(n, 10);
  const c = CHALLENGES.find((x) => x.n === num);
  if (!c) return <p className="p-4 text-sm text-slate-400">Unknown challenge.</p>;
  const meta = CHALLENGE_META[num];
  const mods = MODULES.filter((m) => m.challenges.includes(num));

  return (
    <div>
      <PageHeader
        icon="Puzzle"
        title={<>Challenge {c.n} · <span className="font-normal">{c.name}</span></>}
        subtitle={meta?.desc}
        right={<button className="btn-ghost" onClick={() => nav('/solutions')}><Icon name="ArrowRight" className="h-4 w-4 rotate-180" />All solutions</button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge status="sample" note="prototype uses synthetic data" />
        {meta?.difficulty && <Chip>Difficulty · {meta.difficulty}</Chip>}
        {meta?.subjects.map((s) => <Chip key={s}>{s}</Chip>)}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-3">
        <Glass className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
            <span className="flex items-center gap-2"><StatusBadge status="sample" />Prototype · {c.file}</span>
            <a className="text-sky-300 hover:underline" href={`/prototypes/${c.file}`} target="_blank" rel="noreferrer">open in tab ↗</a>
          </div>
          <iframe title={c.name} src={`/prototypes/${c.file}`} className="h-[640px] w-full bg-white" />
        </Glass>

        <div className="flex flex-col gap-3">
          <Glass className="p-3">
            <div className="h-title">How ORBIT answers this</div>
            {mods.length ? (
              <ul className="mt-2 space-y-2">
                {mods.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => nav(`/module/${m.id}`)} className="w-full rounded-lg border border-white/10 bg-white/[.03] p-2.5 text-left transition hover:border-sky-300/40 hover:bg-sky-500/5">
                      <div className="flex items-center gap-2"><Icon name={m.icon} className="h-4 w-4 text-sky-300" /><span className="text-sm font-semibold text-white">{m.name}</span><Chip>{m.release}</Chip></div>
                      <div className="mt-1 text-[11px] text-slate-400">{m.tagline}</div>
                      <div className="mt-1.5 text-[10px] font-semibold text-sky-300">Open module →</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No ORBIT module maps to this challenge yet — the prototype stands alone.</p>
            )}
          </Glass>
          <Glass className="p-3 text-xs text-slate-300">
            <div className="h-title mb-1">Data honesty</div>
            This prototype uses synthetic sample data to illustrate the method. The corresponding ORBIT module runs the same kernel pattern on real data where it is connected — and labels every figure live, snapshot or sample.
          </Glass>
        </div>
      </div>
    </div>
  );
}
