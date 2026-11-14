import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StoreProvider } from './state/store';

const Analysis = lazy(() => import('./pages/Analysis'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const ModulePage = lazy(() => import('./pages/ModulePage'));
const WorldTwin = lazy(() => import('./pages/WorldTwin'));
const SolutionPage = lazy(() => import('./pages/SolutionPage'));
const Explore = lazy(() => import('./pages/Other').then((m) => ({ default: m.Explore })));
const Missions = lazy(() => import('./pages/Other').then((m) => ({ default: m.Missions })));
const Solutions = lazy(() => import('./pages/Other').then((m) => ({ default: m.Solutions })));
const SDGs = lazy(() => import('./pages/Other').then((m) => ({ default: m.SDGs })));
const Reports = lazy(() => import('./pages/Other').then((m) => ({ default: m.Reports })));
const DataHub = lazy(() => import('./pages/Other').then((m) => ({ default: m.DataHub })));
const Agents = lazy(() => import('./pages/Other').then((m) => ({ default: m.Agents })));
const SettingsPage = lazy(() => import('./pages/Other').then((m) => ({ default: m.SettingsPage })));

function PageLoading() {
  return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-400">Loading ORBIT module…</div>;
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<CommandCenter />} />
              <Route path="explore" element={<Explore />} />
              <Route path="analysis" element={<Analysis />} />
              <Route path="missions" element={<Missions />} />
              <Route path="solutions" element={<Solutions />} />
              <Route path="twin" element={<WorldTwin />} />
              <Route path="solution/:n" element={<SolutionPage />} />
              <Route path="sdgs" element={<SDGs />} />
              <Route path="reports" element={<Reports />} />
              <Route path="module/:id" element={<ModulePage />} />
              <Route path="data" element={<DataHub />} />
              <Route path="agents" element={<Agents />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<CommandCenter />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </StoreProvider>
  );
}
