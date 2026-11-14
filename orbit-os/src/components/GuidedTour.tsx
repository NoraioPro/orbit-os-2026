import { useEffect, useRef, useState } from 'react';
import { Glass, Icon } from './ui';

export interface TourStep { title: string; text: string; selector?: string }

/** Step-by-step guided tour: dims the page, spotlights each section, with a bottom card. */
export function GuidedTour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const spotRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (spotRef.current) spotRef.current.classList.remove('tour-spot');
    spotRef.current = null;
    const cur = steps[i];
    if (cur?.selector) {
      const next = document.querySelector<HTMLElement>(cur.selector);
      if (next) { next.classList.add('tour-spot'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); spotRef.current = next; }
    }
  }, [i, steps]);

  useEffect(() => () => { spotRef.current?.classList.remove('tour-spot'); }, []);

  const finish = () => { spotRef.current?.classList.remove('tour-spot'); spotRef.current = null; onDone(); };
  const step = steps[i];
  if (!step) return null;

  return (
    <>
      <div className="fade-in fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px]" onClick={finish} />
      <div className="fade-in fixed bottom-6 left-1/2 z-50 w-[min(560px,92vw)] -translate-x-1/2">
        <Glass className="border-sky-400/40 p-4 shadow-glow">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2"><Icon name="Compass" className="h-4 w-4 text-sky-300" />Guided tour · step {i + 1} of {steps.length}</span>
            <button onClick={finish} className="text-slate-400 hover:text-white" aria-label="Close tour"><Icon name="X" className="h-4 w-4" /></button>
          </div>
          <div className="mt-1.5 text-base font-semibold text-white">{step.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{step.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}><Icon name="ArrowRight" className="h-4 w-4 rotate-180" />Back</button>
            <div className="flex flex-1 justify-center gap-1.5">{steps.map((_, j) => <span key={j} className={`rounded-full transition-all ${j === i ? 'h-1.5 w-5 bg-sky-300' : 'h-1.5 w-1.5 bg-white/20'}`} />)}</div>
            {i < steps.length - 1
              ? <button className="btn-primary !py-1.5 text-xs" onClick={() => setI((x) => x + 1)}>Next <Icon name="ArrowRight" className="h-4 w-4" /></button>
              : <button className="btn-primary !py-1.5 text-xs" onClick={finish}>Finish <Icon name="Check" className="h-4 w-4" /></button>}
          </div>
        </Glass>
      </div>
    </>
  );
}
