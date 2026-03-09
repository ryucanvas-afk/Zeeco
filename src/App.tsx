import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { TranslationProvider } from './context/TranslationContext';
import { TodoProvider } from './context/TodoContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import Translation from './pages/Translation';
import TodoList from './pages/TodoList';

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
        <TodoProvider>
          <UrlDataLoader />
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<ProjectList />} />
                <Route path="/project/:id" element={<ProjectDetail />} />
                <Route path="/translate" element={<Translation />} />
                <Route path="/todos" element={<TodoList />} />
              </Route>
            </Routes>
          </HashRouter>
        </TodoProvider>
      </TranslationProvider>
    </ProjectProvider>
  );
}

export default App;
