import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { TranslationProvider } from './context/TranslationContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import Translation from './pages/Translation';

function UrlDataLoader() {
  const { importData } = useProjects();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    if (dataParam) {
      try {
        const decoded = decodeURIComponent(atob(dataParam));
        const data = JSON.parse(decoded);
        if (Array.isArray(data)) {
          importData(data);
          // Clean the URL to remove the data parameter
          const cleanUrl = window.location.href.split('?')[0] + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
      } catch {
        // Ignore invalid data
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function App() {
  return (
    <ProjectProvider>
      <TranslationProvider>
        <UrlDataLoader />
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/translate" element={<Translation />} />
            </Route>
          </Routes>
        </HashRouter>
      </TranslationProvider>
    </ProjectProvider>
  );
}

export default App;
