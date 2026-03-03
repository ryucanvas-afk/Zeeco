export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';
export type ItemStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';
export type PurchaseStatus = 'pending' | 'ordered' | 'shipped' | 'delivered' | 'cancelled';

export type ProcurementStatus =
  | 'rfq_writing'
  | 'quoting'
  | 'quote_comparing'
  | 'po_writing'
  | 'internal_approval'
  | 'hq_approval'
  | 'approved'
  | 'manufacturing'
  | 'manufacturing_done'
  | 'delivered';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  client: string;
  color: string;
  hidden: boolean;
  budgetKRW: number;
  budgetUSD: number;
  exchangeRate: number; // USD to KRW
  items: ProjectItem[];
}

export interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  category: string;
  supplier: string;
  requiredDeliveryDate: string;
  procurementStatus: ProcurementStatus;
  purchaseOrderDraft: string;
  notes: string;
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
  orderNumber: string;
  partName: string;
  specification: string;
  quantity: number;
  unit: string;
  supplier: string;
  team: string;
  orderDate: string;
  expectedDelivery: string;
  actualDelivery: string;
  status: PurchaseStatus;
  unitPrice: number;
  currency: string;
  notes: string;
}
