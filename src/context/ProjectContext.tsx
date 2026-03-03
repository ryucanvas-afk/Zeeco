import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project, ProjectItem, Schedule, Purchase, InspectionEntry, FactoryPurchase, SubItem } from '../types';
import { sampleProjects } from '../data/sampleData';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'zeeco-projects';

const SCHEMA_VERSION = 4;
const VERSION_KEY = 'zeeco-schema-version';

// Migrate old data to new schema instead of resetting
function migrateProjects(projects: Record<string, unknown>[]): Project[] {
  return projects.map((p: Record<string, unknown>) => ({
    id: (p.id as string) || uuidv4(),
    name: (p.name as string) || '',
    projectNo: (p.projectNo as string) || '',
    description: (p.description as string) || '',
    status: (p.status as Project['status']) || 'planning',
    contractDate: (p.contractDate as string) || (p as Record<string, unknown>).startDate as string || '',
    komDate: (p.komDate as string) || '',
    deliveryDate: (p.deliveryDate as string) || (p as Record<string, unknown>).endDate as string || '',
    client: (p.client as string) || '',
    color: (p.color as string) || '#3b82f6',
    hidden: (p.hidden as boolean) || false,
    budgetKRW: (p.budgetKRW as number) || 0,
    budgetUSD: (p.budgetUSD as number) || 0,
    exchangeRate: (p.exchangeRate as number) || 1350,
    targetGM: (p.targetGM as number) || 0,
    currentGM: (p.currentGM as number) || 0,
    engineeringHours: (p.engineeringHours as Project['engineeringHours']) || { projecting: 0, drafting: 0, control: 0, inspection: 0 },
    directCost: (p.directCost as number) || 0,
    contingency: (p.contingency as number) || 0,
    needsFactoryManagement: (p.needsFactoryManagement as boolean) || false,
    inspections: (p.inspections as Project['inspections']) || [],
    factoryPurchases: (p.factoryPurchases as Project['factoryPurchases']) || [],
    items: ((p.items as Record<string, unknown>[]) || []).map((i: Record<string, unknown>) => ({
      id: (i.id as string) || uuidv4(),
      projectId: (i.projectId as string) || (p.id as string) || '',
      name: (i.name as string) || '',
      supplier: (i.supplier as string) || '',
      requiredDeliveryDate: (i.requiredDeliveryDate as string) || '',
      requiredDeliveryTBD: (i.requiredDeliveryTBD as boolean) || false,
      procurementStatus: (i.procurementStatus as ProjectItem['procurementStatus']) || 'rfq_writing',
      managementStatus: (i.managementStatus as ProjectItem['managementStatus']) || 'quoting',
      notes: (i.notes as string) || '',
      status: (i.status as ProjectItem['status']) || 'not_started',
      subItems: (i.subItems as ProjectItem['subItems']) || [],
      schedules: (i.schedules as ProjectItem['schedules']) || [],
      purchases: ((i.purchases as Record<string, unknown>[]) || []).map((pu: Record<string, unknown>) => ({
        id: (pu.id as string) || uuidv4(),
        itemId: (pu.itemId as string) || (i.id as string) || '',
        orderNumber: (pu.orderNumber as string) || '',
        partName: (pu.partName as string) || '',
        specification: (pu.specification as string) || '',
        quantity: (pu.quantity as number) || 0,
        unit: (pu.unit as string) || 'EA',
        supplier: (pu.supplier as string) || '',
        team: (pu.team as string) || '',
        orderDate: (pu.orderDate as string) || '',
        expectedDelivery: (pu.expectedDelivery as string) || '',
        actualDelivery: (pu.actualDelivery as string) || '',
        status: (pu.status as Purchase['status']) || 'rfq_writing',
        orderAmount: (pu.orderAmount as number) || ((pu.unitPrice as number) || 0) * ((pu.quantity as number) || 0),
        vat: (pu.vat as number) || 0,
        currency: (pu.currency as string) || 'KRW',
        termsOfPayment: (pu.termsOfPayment as string) || '',
        scopeOfSupply: Array.isArray(pu.scopeOfSupply) ? (pu.scopeOfSupply as string[]) : (pu.scopeOfSupply ? [pu.scopeOfSupply as string] : ['']),
        notes: (pu.notes as string) || '',
        sortOrder: (pu.sortOrder as number) || 0,
      })),
    })),
  }));
}

function loadProjects(): Project[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const version = localStorage.getItem(VERSION_KEY);
        if (version && Number(version) === SCHEMA_VERSION) {
          return parsed;
        }
        // Version mismatch: migrate existing data instead of resetting
        const migrated = migrateProjects(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
        return migrated;
      }
    }
  } catch {
    // ignore parse errors
  }
  localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  return sampleProjects;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Omit<Project, 'id' | 'items' | 'inspections' | 'factoryPurchases'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  toggleHideProject: (id: string) => void;
  addItem: (projectId: string, item: Omit<ProjectItem, 'id' | 'projectId' | 'schedules' | 'purchases' | 'subItems'>) => void;
  updateItem: (projectId: string, itemId: string, updates: Partial<ProjectItem>) => void;
  deleteItem: (projectId: string, itemId: string) => void;
  addSubItem: (projectId: string, itemId: string, subItem: Omit<SubItem, 'id'>) => void;
  updateSubItem: (projectId: string, itemId: string, subItemId: string, updates: Partial<SubItem>) => void;
  deleteSubItem: (projectId: string, itemId: string, subItemId: string) => void;
  addSchedule: (projectId: string, itemId: string, schedule: Omit<Schedule, 'id' | 'itemId'>) => void;
  updateSchedule: (projectId: string, itemId: string, scheduleId: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (projectId: string, itemId: string, scheduleId: string) => void;
  addPurchase: (projectId: string, itemId: string, purchase: Omit<Purchase, 'id' | 'itemId'>) => void;
  updatePurchase: (projectId: string, itemId: string, purchaseId: string, updates: Partial<Purchase>) => void;
  deletePurchase: (projectId: string, itemId: string, purchaseId: string) => void;
  reorderPurchases: (projectId: string, itemId: string, purchaseIds: string[]) => void;
  addInspection: (projectId: string, inspection: Omit<InspectionEntry, 'id'>) => void;
  updateInspection: (projectId: string, inspectionId: string, updates: Partial<InspectionEntry>) => void;
  deleteInspection: (projectId: string, inspectionId: string) => void;
  addFactoryPurchase: (projectId: string, fp: Omit<FactoryPurchase, 'id'>) => void;
  updateFactoryPurchase: (projectId: string, fpId: string, updates: Partial<FactoryPurchase>) => void;
  deleteFactoryPurchase: (projectId: string, fpId: string) => void;
  resetData: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  }, [projects]);

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProjects(sampleProjects);
  };

  const addProject = (project: Omit<Project, 'id' | 'items' | 'inspections' | 'factoryPurchases'>) => {
    setProjects(prev => [...prev, { ...project, id: uuidv4(), items: [], inspections: [], factoryPurchases: [] }]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const toggleHideProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, hidden: !p.hidden } : p));
  };

  const addItem = (projectId: string, item: Omit<ProjectItem, 'id' | 'projectId' | 'schedules' | 'purchases' | 'subItems'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: [...p.items, { ...item, id: uuidv4(), projectId, schedules: [], purchases: [], subItems: [] }],
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

  const addSubItem = (projectId: string, itemId: string, subItem: Omit<SubItem, 'id'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, subItems: [...(i.subItems || []), { ...subItem, id: uuidv4() }] };
        }),
      };
    }));
  };

  const updateSubItem = (projectId: string, itemId: string, subItemId: string, updates: Partial<SubItem>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return {
            ...i,
            subItems: (i.subItems || []).map(si => si.id === subItemId ? { ...si, ...updates } : si),
          };
        }),
      };
    }));
  };

  const deleteSubItem = (projectId: string, itemId: string, subItemId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          return { ...i, subItems: (i.subItems || []).filter(si => si.id !== subItemId) };
        }),
      };
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
          const maxOrder = i.purchases.reduce((max, pu) => Math.max(max, pu.sortOrder || 0), 0);
          return { ...i, purchases: [...i.purchases, { ...purchase, id: uuidv4(), itemId, sortOrder: maxOrder + 1 }] };
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

  const reorderPurchases = (projectId: string, itemId: string, purchaseIds: string[]) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        items: p.items.map(i => {
          if (i.id !== itemId) return i;
          const reordered = purchaseIds.map((pid, idx) => {
            const pu = i.purchases.find(x => x.id === pid);
            return pu ? { ...pu, sortOrder: idx } : null;
          }).filter(Boolean) as Purchase[];
          return { ...i, purchases: reordered };
        }),
      };
    }));
  };

  const addInspection = (projectId: string, inspection: Omit<InspectionEntry, 'id'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, inspections: [...(p.inspections || []), { ...inspection, id: uuidv4() }] };
    }));
  };

  const updateInspection = (projectId: string, inspectionId: string, updates: Partial<InspectionEntry>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        inspections: (p.inspections || []).map(ins => ins.id === inspectionId ? { ...ins, ...updates } : ins),
      };
    }));
  };

  const deleteInspection = (projectId: string, inspectionId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, inspections: (p.inspections || []).filter(ins => ins.id !== inspectionId) };
    }));
  };

  const addFactoryPurchase = (projectId: string, fp: Omit<FactoryPurchase, 'id'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, factoryPurchases: [...(p.factoryPurchases || []), { ...fp, id: uuidv4() }] };
    }));
  };

  const updateFactoryPurchase = (projectId: string, fpId: string, updates: Partial<FactoryPurchase>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        factoryPurchases: (p.factoryPurchases || []).map(fp => fp.id === fpId ? { ...fp, ...updates } : fp),
      };
    }));
  };

  const deleteFactoryPurchase = (projectId: string, fpId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, factoryPurchases: (p.factoryPurchases || []).filter(fp => fp.id !== fpId) };
    }));
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      addProject, updateProject, deleteProject, toggleHideProject,
      addItem, updateItem, deleteItem,
      addSubItem, updateSubItem, deleteSubItem,
      addSchedule, updateSchedule, deleteSchedule,
      addPurchase, updatePurchase, deletePurchase, reorderPurchases,
      addInspection, updateInspection, deleteInspection,
      addFactoryPurchase, updateFactoryPurchase, deleteFactoryPurchase,
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
