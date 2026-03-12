import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project, ProjectItem, Schedule, Purchase, InspectionEntry, FactoryPurchase, SubItem, BudgetItem, BudgetSnapshot, MasterScheduleTask, ScheduleSnapshot } from '../types';
import { sampleProjects } from '../data/sampleData';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'zeeco-projects';

const SCHEMA_VERSION = 12;

const ITEM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
];

const DEFAULT_SCHEDULE_GROUPS = [
  { name: 'Document Approval', color: '#3b82f6' },
  { name: 'Purchasing Materials', color: '#10b981' },
  { name: 'Fabrication', color: '#f59e0b' },
  { name: 'Inspection', color: '#ef4444' },
  { name: 'Packing', color: '#6366f1' },
  { name: 'Delivery', color: '#ec4899' },
];
const VERSION_KEY = 'zeeco-schema-version';

// Migrate old data to new schema instead of resetting
function migrateProjects(projects: Record<string, unknown>[]): Project[] {
  return projects.map((p: Record<string, unknown>) => ({
    id: (p.id as string) || uuidv4(),
    name: (p.name as string) || '',
    projectNo: (p.projectNo as string) || '',
    description: (p.description as string) || '',
    headerNote: (p.headerNote as string) || '',
    status: (p.status as Project['status']) || 'planning',
    contractDate: (p.contractDate as string) || (p as Record<string, unknown>).startDate as string || '',
    komDate: (p.komDate as string) || '',
    deliveryDate: (p.deliveryDate as string) || (p as Record<string, unknown>).endDate as string || '',
    deliverySchedules: (p.deliverySchedules as Project['deliverySchedules']) || [],
    client: (p.client as string) || '',
    color: (p.color as string) || '#3b82f6',
    hidden: (p.hidden as boolean) || false,
    budgetKRW: (p.budgetKRW as number) || 0,
    budgetUSD: (p.budgetUSD as number) || 0,
    exchangeRate: (p.exchangeRate as number) || 1350,
    eurExchangeRate: (p.eurExchangeRate as number) || 1500,
    targetGM: (p.targetGM as number) || 0,
    currentGM: (p.currentGM as number) || 0,
    engineeringCost: (p.engineeringCost as number) || (() => {
      const eh = p.engineeringHours as Record<string, number> | undefined;
      if (eh) return ((eh.projecting || 0) + (eh.drafting || 0) + (eh.control || 0) + (eh.inspection || 0)) * 50000;
      return 0;
    })(),
    directCost: (p.directCost as number) || 0,
    contingency: (p.contingency as number) || 0,
    needsFactoryManagement: (p.needsFactoryManagement as boolean) || false,
    initialContractAmount: (p.initialContractAmount as number) || 0,
    initialContractAmountUSD: (p.initialContractAmountUSD as number) || 0,
    updatedContractAmount: (p.updatedContractAmount as number) || 0,
    updatedContractAmountUSD: (p.updatedContractAmountUSD as number) || 0,
    contractAmountUSD: (p.contractAmountUSD as number) || 0,
    budgetItems: ((p.budgetItems as Record<string, unknown>[]) || []).map((bi: Record<string, unknown>) => ({
      id: (bi.id as string) || uuidv4(),
      part: (bi.part as BudgetItem['part']) || 'PE',
      category: (bi.category as BudgetItem['category']) || 'item',
      name: (bi.name as string) || '',
      originalBudgetUSD: (bi.originalBudgetUSD as number) || 0,
      originalBudgetKRW: (bi.originalBudgetKRW as number) || 0,
      quotationPrice: (bi.quotationPrice as number) || 0,
      quotationCurrency: (bi.quotationCurrency as BudgetItem['quotationCurrency']) || 'KRW',
      quotationOriginalPrice: (bi.quotationOriginalPrice as number) || 0,
      revisedBudget: (bi.revisedBudget as number) || 0,
      supplier: (bi.supplier as string) || '',
      rfqDate: (bi.rfqDate as string) || '',
      rfqIssued: (bi.rfqIssued as boolean) || false,
      poDate: (bi.poDate as string) || '',
      poIssued: (bi.poIssued as boolean) || false,
      expectedDelivery: (bi.expectedDelivery as string) || '',
      requiredDelivery: (bi.requiredDelivery as string) || '',
      remark: (bi.remark as string) || '',
      quoteStatus: (bi.quoteStatus as BudgetItem['quoteStatus']) || 'assumed',
      sortOrder: (bi.sortOrder as number) || 0,
      groupId: (bi.groupId as string) || '',
    })),
    inspections: ((p.inspections as Record<string, unknown>[]) || []).map((ins: Record<string, unknown>) => ({
      id: (ins.id as string) || uuidv4(),
      date: (ins.date as string) || '',
      endDate: (ins.endDate as string) || '',
      items: (ins.items as string[]) || [],
      categories: (ins.categories as string[]) || [],
      unit: (ins.unit as string) || '',
      location: (ins.location as string) || '',
      inspector: (ins.inspector as string) || '',
      observer: (ins.observer as string) || '',
      notes: (ins.notes as string) || '',
      color: (ins.color as string) || '',
    })),
    inspectionCommonNotes: ((p.inspectionCommonNotes as Record<string, unknown>[]) || []).map((n: Record<string, unknown>) => ({
      id: (n.id as string) || uuidv4(),
      text: (n.text as string) || '',
    })),
    factoryPurchases: (p.factoryPurchases as Project['factoryPurchases']) || [],
    budgetSnapshots: (p.budgetSnapshots as Project['budgetSnapshots']) || [],
    masterSchedule: ((p.masterSchedule as Record<string, unknown>[]) || []).map((t: Record<string, unknown>) => ({
      id: (t.id as string) || uuidv4(),
      parentId: (t.parentId as string) || '',
      name: (t.name as string) || '',
      startDate: (t.startDate as string) || '',
      endDate: (t.endDate as string) || '',
      duration: (t.duration as number) || 0,
      progress: (t.progress as number) || 0,
      color: (t.color as string) || '#6366f1',
      expanded: (t.expanded as boolean) ?? true,
      sortOrder: (t.sortOrder as number) || 0,
      note: (t.note as string) || '',
    })),
    scheduleSnapshots: (p.scheduleSnapshots as Project['scheduleSnapshots']) || [],
    items: ((p.items as Record<string, unknown>[]) || []).map((i: Record<string, unknown>, idx: number) => ({
      id: (i.id as string) || uuidv4(),
      projectId: (i.projectId as string) || (p.id as string) || '',
      name: (i.name as string) || '',
      color: (i.color as string) || ITEM_COLORS[idx % ITEM_COLORS.length],
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
  addProject: (project: Omit<Project, 'id' | 'items' | 'inspections' | 'inspectionCommonNotes' | 'factoryPurchases'>) => void;
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
  addBudgetItem: (projectId: string, budgetItem: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (projectId: string, budgetItemId: string, updates: Partial<BudgetItem>) => void;
  deleteBudgetItem: (projectId: string, budgetItemId: string) => void;
  reorderBudgetItems: (projectId: string, budgetItemIds: string[]) => void;
  saveBudgetSnapshot: (projectId: string, name: string) => void;
  deleteBudgetSnapshot: (projectId: string, snapshotId: string) => void;
  loadBudgetSnapshot: (projectId: string, snapshotId: string) => void;
  initializeDefaultSchedule: (projectId: string) => void;
  addMasterTask: (projectId: string, task: Omit<MasterScheduleTask, 'id'>) => void;
  updateMasterTask: (projectId: string, taskId: string, updates: Partial<MasterScheduleTask>) => void;
  deleteMasterTask: (projectId: string, taskId: string) => void;
  reorderMasterTasks: (projectId: string, taskIds: string[]) => void;
  resetMasterSchedule: (projectId: string) => void;
  copyMasterScheduleFrom: (targetProjectId: string, sourceProjectId: string) => void;
  saveScheduleSnapshot: (projectId: string, name: string) => void;
  loadScheduleSnapshot: (projectId: string, snapshotId: string) => void;
  deleteScheduleSnapshot: (projectId: string, snapshotId: string) => void;
  resetItems: (projectId: string) => void;
  copyItemsFrom: (targetProjectId: string, sourceProjectId: string) => void;
  resetBudgetItems: (projectId: string) => void;
  copyBudgetItemsFrom: (targetProjectId: string, sourceProjectId: string) => void;
  reorderProjects: (projectIds: string[]) => void;
  reorderItems: (projectId: string, itemIds: string[]) => void;
  importData: (data: Record<string, unknown>[]) => void;
  resetData: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  }, [projects]);

  const resetItems = (projectId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, items: [] } : p));
  };

  const copyItemsFrom = (targetProjectId: string, sourceProjectId: string) => {
    setProjects(prev => {
      const source = prev.find(p => p.id === sourceProjectId);
      if (!source || !source.items?.length) return prev;
      const cloned: ProjectItem[] = source.items.map(item => {
        const newItemId = uuidv4();
        return {
          ...item,
          id: newItemId,
          projectId: targetProjectId,
          schedules: item.schedules.map(s => ({ ...s, id: uuidv4(), itemId: newItemId })),
          purchases: item.purchases.map(pu => ({ ...pu, id: uuidv4(), itemId: newItemId })),
          subItems: (item.subItems || []).map(si => ({ ...si, id: uuidv4() })),
        };
      });
      return prev.map(p => p.id === targetProjectId ? { ...p, items: cloned } : p);
    });
  };

  const resetBudgetItems = (projectId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, budgetItems: [] } : p));
  };

  const copyBudgetItemsFrom = (targetProjectId: string, sourceProjectId: string) => {
    setProjects(prev => {
      const source = prev.find(p => p.id === sourceProjectId);
      if (!source || !source.budgetItems?.length) return prev;
      const cloned: BudgetItem[] = source.budgetItems.map(bi => ({
        ...bi,
        id: uuidv4(),
      }));
      return prev.map(p => p.id === targetProjectId ? { ...p, budgetItems: cloned } : p);
    });
  };

  const reorderProjects = (projectIds: string[]) => {
    setProjects(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      const reordered = projectIds.map(id => map.get(id)).filter(Boolean) as Project[];
      // Add any projects not in the reorder list (shouldn't happen but safety)
      const remaining = prev.filter(p => !projectIds.includes(p.id));
      return [...reordered, ...remaining];
    });
  };

  const reorderItems = (projectId: string, itemIds: string[]) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const map = new Map(p.items.map(i => [i.id, i]));
      const reordered = itemIds.map(id => map.get(id)).filter(Boolean) as typeof p.items;
      const remaining = p.items.filter(i => !itemIds.includes(i.id));
      return { ...p, items: [...reordered, ...remaining] };
    }));
  };

  const importData = (data: Record<string, unknown>[]) => {
    const migrated = migrateProjects(data);
    setProjects(migrated);
  };

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProjects(sampleProjects);
  };

  const addProject = (project: Omit<Project, 'id' | 'items' | 'inspections' | 'inspectionCommonNotes' | 'factoryPurchases'>) => {
    setProjects(prev => [...prev, { ...project, id: uuidv4(), items: [], inspections: [], inspectionCommonNotes: [], factoryPurchases: [], budgetItems: project.budgetItems || [], masterSchedule: [], scheduleSnapshots: [] }]);
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
      const color = item.color || ITEM_COLORS[p.items.length % ITEM_COLORS.length];
      return {
        ...p,
        items: [...p.items, { ...item, color, id: uuidv4(), projectId, schedules: [], purchases: [], subItems: [] }],
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

  const addBudgetItem = (projectId: string, budgetItem: Omit<BudgetItem, 'id'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, budgetItems: [...(p.budgetItems || []), { ...budgetItem, id: uuidv4() }] };
    }));
  };

  const updateBudgetItem = (projectId: string, budgetItemId: string, updates: Partial<BudgetItem>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        budgetItems: (p.budgetItems || []).map(bi => bi.id === budgetItemId ? { ...bi, ...updates } : bi),
      };
    }));
  };

  const deleteBudgetItem = (projectId: string, budgetItemId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, budgetItems: (p.budgetItems || []).filter(bi => bi.id !== budgetItemId) };
    }));
  };

  const saveBudgetSnapshot = (projectId: string, name: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const snapshot: BudgetSnapshot = {
        id: uuidv4(),
        name,
        createdAt: new Date().toISOString(),
        exchangeRate: p.exchangeRate,
        eurExchangeRate: p.eurExchangeRate,
        initialContractAmount: p.initialContractAmount,
        initialContractAmountUSD: p.initialContractAmountUSD,
        updatedContractAmount: p.updatedContractAmount,
        updatedContractAmountUSD: p.updatedContractAmountUSD,
        targetGM: p.targetGM,
        budgetItems: JSON.parse(JSON.stringify(p.budgetItems || [])),
      };
      return { ...p, budgetSnapshots: [...(p.budgetSnapshots || []), snapshot] };
    }));
  };

  const deleteBudgetSnapshot = (projectId: string, snapshotId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, budgetSnapshots: (p.budgetSnapshots || []).filter(s => s.id !== snapshotId) };
    }));
  };

  const loadBudgetSnapshot = (projectId: string, snapshotId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const snapshot = (p.budgetSnapshots || []).find(s => s.id === snapshotId);
      if (!snapshot) return p;
      return {
        ...p,
        exchangeRate: snapshot.exchangeRate,
        eurExchangeRate: snapshot.eurExchangeRate,
        initialContractAmount: snapshot.initialContractAmount,
        initialContractAmountUSD: snapshot.initialContractAmountUSD,
        updatedContractAmount: snapshot.updatedContractAmount,
        updatedContractAmountUSD: snapshot.updatedContractAmountUSD,
        targetGM: snapshot.targetGM,
        budgetItems: JSON.parse(JSON.stringify(snapshot.budgetItems)),
      };
    }));
  };

  const initializeDefaultSchedule = (projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if ((p.masterSchedule || []).length > 0) return p;
      const today = new Date().toISOString().split('T')[0];
      const defaultTasks: MasterScheduleTask[] = DEFAULT_SCHEDULE_GROUPS.map((g, idx) => ({
        id: uuidv4(),
        parentId: '',
        name: g.name,
        startDate: today,
        endDate: '',
        duration: 0,
        progress: 0,
        color: g.color,
        expanded: true,
        sortOrder: idx,
        note: '',
      }));
      return { ...p, masterSchedule: defaultTasks };
    }));
  };

  const resetMasterSchedule = (projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const today = new Date().toISOString().split('T')[0];
      const defaultTasks: MasterScheduleTask[] = DEFAULT_SCHEDULE_GROUPS.map((g, idx) => ({
        id: uuidv4(),
        parentId: '',
        name: g.name,
        startDate: today,
        endDate: '',
        duration: 0,
        progress: 0,
        color: g.color,
        expanded: true,
        sortOrder: idx,
        note: '',
      }));
      return { ...p, masterSchedule: defaultTasks };
    }));
  };

  const copyMasterScheduleFrom = (targetProjectId: string, sourceProjectId: string) => {
    setProjects(prev => {
      const source = prev.find(p => p.id === sourceProjectId);
      if (!source || !source.masterSchedule?.length) return prev;
      // Deep clone and assign new IDs, preserving parentId mapping
      const idMap = new Map<string, string>();
      source.masterSchedule.forEach(t => idMap.set(t.id, uuidv4()));
      const cloned: MasterScheduleTask[] = source.masterSchedule.map(t => ({
        ...t,
        id: idMap.get(t.id) || uuidv4(),
        parentId: t.parentId ? (idMap.get(t.parentId) || '') : '',
        progress: 0,
      }));
      return prev.map(p => p.id === targetProjectId ? { ...p, masterSchedule: cloned } : p);
    });
  };

  const addMasterTask = (projectId: string, task: Omit<MasterScheduleTask, 'id'>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, masterSchedule: [...(p.masterSchedule || []), { ...task, id: uuidv4() }] };
    }));
  };

  const updateMasterTask = (projectId: string, taskId: string, updates: Partial<MasterScheduleTask>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        masterSchedule: (p.masterSchedule || []).map(t => t.id === taskId ? { ...t, ...updates } : t),
      };
    }));
  };

  const deleteMasterTask = (projectId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      // Delete the task and all its children
      const ms = p.masterSchedule || [];
      const idsToDelete = new Set<string>();
      const collectChildren = (parentId: string) => {
        idsToDelete.add(parentId);
        ms.filter(t => t.parentId === parentId).forEach(t => collectChildren(t.id));
      };
      collectChildren(taskId);
      return { ...p, masterSchedule: ms.filter(t => !idsToDelete.has(t.id)) };
    }));
  };

  const reorderMasterTasks = (projectId: string, taskIds: string[]) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const map = new Map((p.masterSchedule || []).map(t => [t.id, t]));
      const reordered = taskIds.map((id, idx) => {
        const t = map.get(id);
        return t ? { ...t, sortOrder: idx } : null;
      }).filter(Boolean) as MasterScheduleTask[];
      return { ...p, masterSchedule: reordered };
    }));
  };

  const saveScheduleSnapshot = (projectId: string, name: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const snapshot: ScheduleSnapshot = {
        id: uuidv4(),
        name,
        createdAt: new Date().toISOString(),
        tasks: JSON.parse(JSON.stringify(p.masterSchedule || [])),
      };
      return { ...p, scheduleSnapshots: [...(p.scheduleSnapshots || []), snapshot] };
    }));
  };

  const loadScheduleSnapshot = (projectId: string, snapshotId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const snapshot = (p.scheduleSnapshots || []).find(s => s.id === snapshotId);
      if (!snapshot) return p;
      return { ...p, masterSchedule: JSON.parse(JSON.stringify(snapshot.tasks)) };
    }));
  };

  const deleteScheduleSnapshot = (projectId: string, snapshotId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, scheduleSnapshots: (p.scheduleSnapshots || []).filter(s => s.id !== snapshotId) };
    }));
  };

  const reorderBudgetItems = (projectId: string, budgetItemIds: string[]) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const map = new Map((p.budgetItems || []).map(bi => [bi.id, bi]));
      const reordered = budgetItemIds.map((id, idx) => {
        const bi = map.get(id);
        return bi ? { ...bi, sortOrder: idx } : null;
      }).filter(Boolean) as BudgetItem[];
      return { ...p, budgetItems: reordered };
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
      addBudgetItem, updateBudgetItem, deleteBudgetItem, reorderBudgetItems,
      saveBudgetSnapshot, deleteBudgetSnapshot, loadBudgetSnapshot,
      initializeDefaultSchedule, resetMasterSchedule, copyMasterScheduleFrom,
      addMasterTask, updateMasterTask, deleteMasterTask, reorderMasterTasks,
      saveScheduleSnapshot, loadScheduleSnapshot, deleteScheduleSnapshot,
      resetItems, copyItemsFrom, resetBudgetItems, copyBudgetItemsFrom,
      reorderProjects, reorderItems,
      importData, resetData,
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
