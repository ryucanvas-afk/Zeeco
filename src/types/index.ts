export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';
export type ItemStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';
export type PurchaseStatus = 'pending' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  client: string;
  items: ProjectItem[];
}

export interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  category: string;
  status: ItemStatus;
  schedules: Schedule[];
  purchases: Purchase[];
}

export interface Schedule {
  id: string;
  itemId: string;
  task: string;
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  status: ItemStatus;
  assignee: string;
  notes: string;
}

export interface Purchase {
  id: string;
  itemId: string;
  partName: string;
  specification: string;
  quantity: number;
  unit: string;
  supplier: string;
  orderDate: string;
  expectedDelivery: string;
  actualDelivery: string;
  status: PurchaseStatus;
  unitPrice: number;
  currency: string;
  notes: string;
}
