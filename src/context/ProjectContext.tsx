import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project, ProjectItem, Schedule, Purchase } from '../types';
import { sampleProjects } from '../data/sampleData';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'zeeco-projects';

function loadProjects(): Project[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore parse errors
  }
  return sampleProjects;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Omit<Project, 'id' | 'items'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addItem: (projectId: string, item: Omit<ProjectItem, 'id' | 'projectId' | 'schedules' | 'purchases'>) => void;
  updateItem: (projectId: string, itemId: string, updates: Partial<ProjectItem>) => void;
  deleteItem: (projectId: string, itemId: string) => void;
  addSchedule: (projectId: string, itemId: string, schedule: Omit<Schedule, 'id' | 'itemId'>) => void;
  updateSchedule: (projectId: string, itemId: string, scheduleId: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (projectId: string, itemId: string, scheduleId: string) => void;
  addPurchase: (projectId: string, itemId: string, purchase: Omit<Purchase, 'id' | 'itemId'>) => void;
  updatePurchase: (projectId: string, itemId: string, purchaseId: string, updates: Partial<Purchase>) => void;
  deletePurchase: (projectId: string, itemId: string, purchaseId: string) => void;
  resetData: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProjects(sampleProjects);
  };

  const addProject = (project: Omit<Project, 'id' | 'items'>) => {
    setProjects(prev => [...prev, { ...project, id: uuidv4(), items: [] }]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const addItem = (projectId: string, item: Omit<ProjectItem, 'id' | 'projectId' | 'schedules' | 'purchases'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: [...p.items, { ...item, id: uuidv4(), projectId, schedules: [], purchases: [] }],
      };
    }));
  };

  const updateItem = (projectId: string, itemId: string, updates: Partial<ProjectItem>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => i.id === itemId ? { ...i, ...updates } : i),
      };
    }));
  };

  const deleteItem = (projectId: string, itemId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, items: p.items.filter(i => i.id !== itemId) };
    }));
  };

  const addSchedule = (projectId: string, itemId: string, schedule: Omit<Schedule, 'id' | 'itemId'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, schedules: [...i.schedules, { ...schedule, id: uuidv4(), itemId }] };
        }),
      };
    }));
  };

  const updateSchedule = (projectId: string, itemId: string, scheduleId: string, updates: Partial<Schedule>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return {
            ...i,
            schedules: i.schedules.map(s => s.id === scheduleId ? { ...s, ...updates } : s),
          };
        }),
      };
    }));
  };

  const deleteSchedule = (projectId: string, itemId: string, scheduleId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, schedules: i.schedules.filter(s => s.id !== scheduleId) };
        }),
      };
    }));
  };

  const addPurchase = (projectId: string, itemId: string, purchase: Omit<Purchase, 'id' | 'itemId'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, purchases: [...i.purchases, { ...purchase, id: uuidv4(), itemId }] };
        }),
      };
    }));
  };

  const updatePurchase = (projectId: string, itemId: string, purchaseId: string, updates: Partial<Purchase>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return {
            ...i,
            purchases: i.purchases.map(pu => pu.id === purchaseId ? { ...pu, ...updates } : pu),
          };
        }),
      };
    }));
  };

  const deletePurchase = (projectId: string, itemId: string, purchaseId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, purchases: i.purchases.filter(pu => pu.id !== purchaseId) };
        }),
      };
    }));
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      addProject, updateProject, deleteProject,
      addItem, updateItem, deleteItem,
      addSchedule, updateSchedule, deleteSchedule,
      addPurchase, updatePurchase, deletePurchase,
      resetData,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjects must be used within ProjectProvider');
  return context;
}
