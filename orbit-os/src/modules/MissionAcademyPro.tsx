import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { allocate } from '../kernel';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';

/* ============================================================================
   Mission Academy Pro — unified component for challenges #1, #3 and #13.
   Data honesty: NASA images are LIVE (images-api.nasa.gov). All life-support
   and mass-budget numbers are EDUCATIONAL SAMPLE values, not engineering data.
   ========================================================================== */

type Tab = 'hardware' | 'outpost' | 'design';

const HonestyNote = ({ children }: { children: ReactNode }) => (
  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200">
    <StatusBadge status="sample" />
    <span>{children}</span>
  </div>
);

const LiveNote = ({ children }: { children: ReactNode }) => (
  <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2 text-[11px] text-emerald-200">
    <StatusBadge status="live" />
    <span>{children}</span>
  </div>
);

/* ------------------------------ Tab chrome ------------------------------ */

const TABS: { id: Tab; label: string; icon: string; challenge: string }[] = [
  { id: 'hardware', label: 'Retired hardware', icon: 'Moon', challenge: '#1' },
  { id: 'outpost', label: 'Outpost trainer', icon: 'Bot', challenge: '#3' },
  { id: 'design', label: 'Mission design', icon: 'Rocket', challenge: '#13' },
];

/* ============================ Tab 1 · Retired hardware ============================ */

interface Hardware {
  id: string;
  name: string;
  agency: string;
  world: string;
  icon: string;
  location: string;
  years: string;
  blurb: string;
  query: string;
}

const HARDWARE: Hardware[] = [
  {
    id: 'viking1', name: 'Viking 1 Lander', agency: 'NASA', world: 'Mars', icon: 'Mars',
    location: 'Chryse Planitia', years: '1976–1982',
    blurb: 'The first US spacecraft to land on Mars. It returned the first images from the Martian surface and ran biology experiments whose results are still debated today.',
    query: 'Viking 1 Lander',
  },
  {
    id: 'viking2', name: 'Viking 2 Lander', agency: 'NASA', world: 'Mars', icon: 'Mars',
    location: 'Utopia Planitia', years: '1976–1980',
    blurb: 'Sister lander to Viking 1, resting in the northern plains. Its soil chemistry and (eventually repaired) seismometer still inform Mars science.',
    query: 'Viking 2 Lander',
  },
  {
    id: 'surveyor3', name: 'Surveyor 3', agency: 'NASA', world: 'Moon', icon: 'Moon',
    location: 'Oceanus Procellarum', years: '1967',
    blurb: 'Landed in the Ocean of Storms. Two years later Apollo 12 landed nearby and its crew walked over to Surveyor 3 — the only human visit to a probe already sitting on another world.',
    query: 'Surveyor 3 lunar lander',
  },
  {
    id: 'lunokhod1', name: 'Lunokhod 1', agency: 'USSR', world: 'Moon', icon: 'Moon',
    location: 'Mare Imbrium', years: '1970–1971',
    blurb: 'The first remote-controlled rover on another world. It drove about 10.5 km across Mare Imbrium and was only relocated decades later, by laser ranging in 2010.',
    query: 'Lunokhod 1 rover',
  },
  {
    id: 'huygens', name: 'Huygens', agency: 'ESA / NASA', world: 'Titan (Saturn moon)', icon: 'Globe2',
    location: 'near the Xanadu region', years: '2005',
    blurb: 'Cassini’s probe, parachuted onto Titan — the only landing ever made in the outer Solar System. Not the Moon or Mars: it rests on Saturn’s largest moon.',
    query: 'Huygens probe Titan',
  },
  {
    id: 'opportunity', name: 'Opportunity (MER-B)', agency: 'NASA', world: 'Mars', icon: 'Mars',
    location: 'Meridiani Planum', years: '2004–2018',
    blurb: 'Holds the off-world driving record at 45.16 km. Finally silenced in 2018 when a planet-wide dust storm starved its solar panels.',
    query: 'Opportunity rover Mars',
  },
  {
    id: 'sojourner', name: 'Sojourner', agency: 'NASA', world: 'Mars', icon: 'Mars',
    location: 'Ares Vallis', years: '1997',
    blurb: 'The first rover to drive on Mars, part of Mars Pathfinder. A microwave-sized pioneer that proved roving across another planet works.',
    query: 'Sojourner rover Mars Pathfinder',
  },
  {
    id: 'apollo11', name: 'Apollo 11 LM descent stage', agency: 'NASA', world: 'Moon', icon: 'Moon',
    location: 'Mare Tranquillitatis', years: '1969',
    blurb: 'The Eagle’s lower stage still stands in the Sea of Tranquility. Its ascent stage was jettisoned after docking and later crashed onto the surface.',
    query: 'Apollo 11 lunar module',
  },
];

interface NasaImage { href: string; title: string; nasaId: string }

async function fetchNasaImage(query: string): Promise<NasaImage | null> {
  try {
    const r = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      collection?: { items?: { links?: { href?: string }[]; data?: { title?: string; nasa_id?: string }[] }[] };
    };
    const first = j.collection?.items?.[0];
    const href = first?.links?.[0]?.href;
    if (!href) return null;
    return { href, title: first?.data?.[0]?.title ?? '', nasaId: first?.data?.[0]?.nasa_id ?? '' };
  } catch {
    return null;
  }
}

type ImgState = { status: 'loading' | 'ok' | 'none'; href?: string; title?: string; nasaId?: string };

function NasaCard({ hw }: { hw: Hardware }) {
  const [img, setImg] = useState<ImgState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    fetchNasaImage(hw.query).then((res) => {
      if (!active) return;
      setImg(res ? { status: 'ok', href: res.href, title: res.title, nasaId: res.nasaId } : { status: 'none' });
    });
    return () => { active = false; };
  }, [hw.query]);
  return (
    <Glass className="lift overflow-hidden p-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
        {img.status === 'ok' && img.href && (
          <img src={img.href} alt={img.title || hw.name} loading="lazy" className="h-full w-full object-cover" />
        )}
        {img.status === 'loading' && (
          <div className="flex h-full items-center justify-center text-slate-500"><Icon name="Satellite" className="h-6 w-6 animate-pulse" /></div>
        )}
        {img.status === 'none' && (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-500">
            <Icon name={hw.icon} className="h-6 w-6" />
            <span className="text-[11px]">No NASA image returned</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
          <StatusBadge status="live" note="NASA Image API" />
          {img.status === 'ok' && img.nasaId && <Chip className="border-white/20 bg-black/40 text-slate-200">{img.nasaId}</Chip>}
        </div>
        {img.status === 'ok' && img.title && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-[11px] text-slate-200">{img.title}</div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white">{hw.name}</div>
          <Chip>{hw.agency}</Chip>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1 text-slate-300"><Icon name={hw.icon} className="h-3.5 w-3.5" />{hw.world}</span>
          <span>·</span><span>{hw.location}</span>
          <span>·</span><span className="text-slate-500">{hw.years}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{hw.blurb}</p>
      </div>
    </Glass>
  );
}

function RetiredHardware() {
  return (
    <div>
      <LiveNote>
        Images are fetched live from the NASA Image API (<code className="text-emerald-300">images-api.nasa.gov</code>) on load; the first
        result for each name is shown with its real title and ID. If nothing is returned, the card says so. Hardware facts are from mission history.
      </LiveNote>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HARDWARE.map((hw) => <NasaCard key={hw.id} hw={hw} />)}
      </div>
    </div>
  );
}

/* ============================ Tab 2 · Outpost trainer ============================ */

interface LifeSystem { id: string; name: string; cost: number; power: number; water: number; food: number; value: number }

// value is derived from contributions so the sample scoring stays self-consistent.
const LIFE_SYSTEMS: LifeSystem[] = (
  [
    { id: 'solar', name: 'Solar array (18 kW)', cost: 30, power: 6, water: 0, food: 0 },
    { id: 'battery', name: 'Battery buffer', cost: 18, power: 3, water: 0, food: 0 },
    { id: 'recycle', name: 'Water recycler', cost: 26, power: 0, water: 9, food: 0 },
    { id: 'tank', name: 'Water storage', cost: 12, power: 0, water: 5, food: 0 },
    { id: 'green', name: 'Greenhouse', cost: 32, power: 0, water: 0, food: 4 },
    { id: 'stores', name: 'Food stores', cost: 16, power: 0, water: 0, food: 6 },
  ] as Omit<LifeSystem, 'value'>[]
).map((s) => ({ ...s, value: Math.round(s.power * 4 + s.water * 3 + s.food * 5) }));

// Per-person daily needs (educational sample constants).
const PER_PERSON = { power: 1.5, water: 3.0, food: 1.5 };

const Meter = ({ label, icon, have, need }: { label: string; icon: string; have: number; need: number }) => {
  const pct = need <= 0 ? 100 : Math.min(100, Math.round((have / need) * 100));
  const ok = have >= need;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-slate-300"><Icon name={icon} className="h-3.5 w-3.5" />{label}</span>
        <span className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? 'balanced' : `−${(need - have).toFixed(1)} short`}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded bg-white/10">
        <div className="h-1.5 rounded transition-all" style={{ width: `${pct}%`, background: ok ? '#34d399' : '#fb7185' }} />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{have.toFixed(1)} / {need.toFixed(1)} units</div>
    </div>
  );
};

function OutpostTrainer() {
  const [crew, setCrew] = useState(4);
  const [budget, setBudget] = useState(90);
  const maxBudget = LIFE_SYSTEMS.reduce((a, s) => a + s.cost, 0); // 134

  const plan = useMemo(() => allocate(LIFE_SYSTEMS.map(({ id, name, cost, value }) => ({ id, name, cost, value })), budget), [budget]);
  const chosenIds = new Set(plan.chosen.map((c) => c.id));
  const totals = LIFE_SYSTEMS.filter((s) => chosenIds.has(s.id)).reduce(
    (a, s) => ({ power: a.power + s.power, water: a.water + s.water, food: a.food + s.food }),
    { power: 0, water: 0, food: 0 },
  );
  const needs = { power: crew * PER_PERSON.power, water: crew * PER_PERSON.water, food: crew * PER_PERSON.food };

  return (
    <div>
      <HonestyNote>
        Life-support numbers are educational sample values, not engineering data. The kernel’s <code className="text-amber-300">allocate()</code>{' '}
        (scarce-resource planning) picks the subset of systems that maximises support value under your supply budget.
      </HonestyNote>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3">
        <Glass className="p-4">
          <div className="h-title">Life-support balance</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Meter label="Power (kW)" icon="Zap" have={totals.power} need={needs.power} />
            <Meter label="Water (L/day)" icon="Droplets" have={totals.water} need={needs.water} />
            <Meter label="Food (kg/day)" icon="Leaf" have={totals.food} need={needs.food} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {LIFE_SYSTEMS.map((s) => {
              const on = chosenIds.has(s.id);
              const contrib = [s.power && `${s.power} kW`, s.water && `${s.water} L`, s.food && `${s.food} kg`].filter(Boolean).join(' · ');
              return (
                <div key={s.id} className={`rounded-lg border px-2 py-1.5 ${on ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-white/10 text-slate-400'}`}>
                  <div className="font-medium">{on ? '✓ ' : ''}{s.name}</div>
                  <div className="text-[10px] opacity-80">{contrib || '—'} · cost {s.cost} · value {s.value}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {plan.method}: used {plan.used}/{budget} supply units, support value {plan.value}. Kernel: scarce-resource planning.
          </p>
        </Glass>
        <Glass className="p-4">
          <div className="h-title">Crew & supply</div>
          <div className="mt-2 flex gap-1.5">
            {[2, 4, 6].map((n) => (
              <button key={n} onClick={() => setCrew(n)} className={`rounded-full px-3 py-1 text-xs ${crew === n ? 'bg-sky-500/30 text-white' : 'text-slate-400 hover:bg-white/5'}`}>{n} crew</button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-slate-300">
            Supply budget: <b>{budget}</b> units
            <input type="range" min={20} max={maxBudget} value={budget} onChange={(e) => setBudget(+e.target.value)} className="w-full" />
          </label>
          <div className="mt-3 space-y-1 text-[11px] text-slate-400">
            <div>Per-person need (sample): {PER_PERSON.power} kW · {PER_PERSON.water} L · {PER_PERSON.food} kg/day.</div>
            <div>Required for {crew} crew: {needs.power.toFixed(1)} kW · {needs.water.toFixed(1)} L · {needs.food.toFixed(1)} kg/day.</div>
          </div>
        </Glass>
      </div>
    </div>
  );
}

/* ============================ Tab 3 · Mission design ============================ */

const PAYLOADS: { id: string; name: string; mass: number; value: number; icon: string; note: string }[] = [
  { id: 'hab', name: 'Pressurised habitat', mass: 420, value: 90, icon: 'Building2', note: 'living & lab volume' },
  { id: 'solar', name: 'Solar array (12 kW)', mass: 180, value: 70, icon: 'Zap', note: 'primary power' },
  { id: 'isru', name: 'ISRU water extractor', mass: 350, value: 85, icon: 'Droplets', note: 'in-situ water' },
  { id: 'rover', name: 'Pressurised rover', mass: 520, value: 60, icon: 'Bot', note: 'long-range mobility' },
  { id: 'comms', name: 'Relay comms', mass: 90, value: 55, icon: 'Radio', note: 'Earth link' },
  { id: 'sci', name: 'Science drill', mass: 160, value: 50, icon: 'Mountain', note: 'subsurface sampling' },
  { id: 'med', name: 'Medical bay', mass: 140, value: 45, icon: 'HeartPulse', note: 'crew health' },
  { id: 'green', name: 'Greenhouse module', mass: 260, value: 40, icon: 'Sprout', note: 'food & O₂' },
  { id: 'eva', name: 'EVA suits (x4)', mass: 200, value: 48, icon: 'ShieldCheck', note: 'surface ops' },
];

function MissionDesign() {
  const [mass, setMass] = useState(1000);
  const plan = useMemo(
    () => allocate(PAYLOADS.map(({ id, name, mass: cost, value }) => ({ id, name, cost, value })), mass),
    [mass],
  );
  const chosenIds = new Set(plan.chosen.map((c) => c.id));
  return (
    <div>
      <HonestyNote>
        Educational masses and value scores, not engineering data. <code className="text-amber-300">allocate()</code> fits the highest-value
        payload set under your landed-mass budget.
      </HonestyNote>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3">
        <Glass className="p-4">
          <div className="h-title">Payload manifest</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
            {PAYLOADS.map((p) => {
              const on = chosenIds.has(p.id);
              return (
                <div key={p.id} className={`rounded-lg border p-2 ${on ? 'border-amber-400/40 bg-amber-500/10 text-amber-100' : 'border-white/10 text-slate-400'}`}>
                  <div className="flex items-center gap-1.5 font-medium"><Icon name={p.icon} className="h-3.5 w-3.5" />{on ? '✓ ' : ''}{p.name}</div>
                  <div className="mt-0.5 text-[10px] opacity-80">{p.mass} kg · value {p.value}</div>
                  <div className="text-[10px] opacity-60">{p.note}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {plan.method}: {plan.used} kg used of {mass} kg, mission value {plan.value}. Kernel: scarce-resource planning.
          </p>
        </Glass>
        <Glass className="p-4">
          <div className="h-title">Mass budget</div>
          <label className="mt-2 block text-xs text-slate-300">
            Landed mass: <b>{mass} kg</b>
            <input type="range" min={300} max={2200} step={50} value={mass} onChange={(e) => setMass(+e.target.value)} className="w-full" />
          </label>
          <div className="mt-3 h-2 rounded bg-white/10">
            <div className="h-2 rounded bg-amber-400/80 transition-all" style={{ width: `${Math.min(100, Math.round((plan.used / mass) * 100))}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>used {plan.used} kg</span><span>free {mass - plan.used} kg</span></div>
          <div className="mt-3 space-y-1 text-[11px] text-slate-400">
            <div>{plan.chosen.length} of {PAYLOADS.length} payloads selected.</div>
            <div>Unused mass goes to margin, shielding or spares — sample trade-offs, not engineering numbers.</div>
          </div>
        </Glass>
      </div>
    </div>
  );
}

/* ============================ Main component ============================ */

export default function MissionAcademyPro() {
  const [tab, setTab] = useState<Tab>('hardware');
  return (
    <div className="page-in">
      <PageHeader
        icon="Gamepad2"
        title="Mission Academy"
        subtitle="Learn by designing missions under real limits — challenges #1, #3 and #13."
        right={
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-2 text-[10px] text-slate-400">
              <StatusBadge status="live" note="NASA images" />
              <StatusBadge status="sample" note="balance & mass" />
            </span>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id ? 'border-amber-400/40 bg-amber-500/15 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
            <Chip className="ml-1 !px-1.5 !text-[10px] text-slate-400">{t.challenge}</Chip>
          </button>
        ))}
      </div>
      {tab === 'hardware' && <RetiredHardware />}
      {tab === 'outpost' && <OutpostTrainer />}
      {tab === 'design' && <MissionDesign />}
    </div>
  );
}

export { MissionAcademyPro };
