import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Analysis from './pages/Analysis';
import CommandCenter from './pages/CommandCenter';
import ModulePage from './pages/ModulePage';
import { Agents, DataHub, Explore, Missions, Reports, SDGs, SettingsPage, Solutions } from './pages/Other';
import { StoreProvider } from './state/store';

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CommandCenter />} />
            <Route path="explore" element={<Explore />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="missions" element={<Missions />} />
            <Route path="solutions" element={<Solutions />} />
            <Route path="sdgs" element={<SDGs />} />
            <Route path="reports" element={<Reports />} />
            <Route path="module/:id" element={<ModulePage />} />
            <Route path="data" element={<DataHub />} />
            <Route path="agents" element={<Agents />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<CommandCenter />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
