export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';
export type ItemStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export type PurchaseStatus =
  | 'rfq_writing'
  | 'internal_approval'
  | 'zoe_approval'
  | 'po_completed'
  | 'manufacturing'
  | 'inspecting'
  | 'delivered'
  | 'partial_delivered';

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

export type ItemManagementStatus =
  | 'quoting'
  | 'approval'
  | 'manufacturing'
  | 'delivering'
  | 'delivered'
  | 'partial_delivered';

export interface Project {
  id: string;
  name: string;
  projectNo: string;
  description: string;
  status: ProjectStatus;
  contractDate: string;
  komDate: string;
  deliveryDate: string;
  client: string;
  color: string;
  hidden: boolean;
  budgetKRW: number;
  budgetUSD: number;
  exchangeRate: number;
  targetGM: number;
  currentGM: number;
  engineeringHours: EngineeringHours;
  directCost: number;
  contingency: number;
  needsFactoryManagement: boolean;
  items: ProjectItem[];
  inspections: InspectionEntry[];
  factoryPurchases: FactoryPurchase[];
}

export interface EngineeringHours {
  projecting: number;
  drafting: number;
  control: number;
  inspection: number;
}

export interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  supplier: string;
  requiredDeliveryDate: string;
  requiredDeliveryTBD: boolean;
  procurementStatus: ProcurementStatus;
  managementStatus: ItemManagementStatus;
  notes: string;
  status: ItemStatus;
  subItems: SubItem[];
  schedules: Schedule[];
  purchases: Purchase[];
}

export interface SubItem {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  notes: string;
}

export interface Schedule {
  id: string;
  itemId: string;
  task: string;
  startDate: string;
  endDate: string;
  progress: number;
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
  orderAmount: number;
  vat: number;
  currency: string;
  termsOfPayment: string;
  scopeOfSupply: string;
  notes: string;
  sortOrder: number;
}

export interface InspectionEntry {
  id: string;
  date: string;
  items: string[];
  categories: string[];
  location: string;
  inspector: string;
  observer: string;
  notes: string;
}

export interface FactoryPurchase {
  id: string;
  partName: string;
  supplier: string;
  orderDate: string;
  expectedDelivery: string;
  status: string;
  amount: number;
  currency: string;
  notes: string;
}
