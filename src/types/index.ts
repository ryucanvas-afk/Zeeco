export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';
export type ItemStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export type PurchaseStatus =
  | 'rfq_writing'
  | 'rfq_requesting'
  | 'price_negotiating'
  | 'internal_approval'
  | 'zoe_approval'
  | 'po_reviewing'
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

export interface DeliveryScheduleEntry {
  id: string;
  label: string;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  projectNo: string;
  description: string;
  headerNote: string;
  status: ProjectStatus;
  contractDate: string;
  komDate: string;
  deliveryDate: string;
  deliverySchedules: DeliveryScheduleEntry[];
  client: string;
  color: string;
  hidden: boolean;
  budgetKRW: number;
  budgetUSD: number;
  exchangeRate: number;
  eurExchangeRate: number;
  targetGM: number;
  currentGM: number;
  engineeringCost: number;
  directCost: number;
  contingency: number;
  needsFactoryManagement: boolean;
  initialContractAmount: number;
  initialContractAmountUSD: number;
  updatedContractAmount: number;
  updatedContractAmountUSD: number;
  contractAmountUSD: number;
  budgetItems: BudgetItem[];
  items: ProjectItem[];
  inspections: InspectionEntry[];
  factoryPurchases: FactoryPurchase[];
  budgetSnapshots: BudgetSnapshot[];
}

export interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  color: string;
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
  scopeOfSupply: string[];
  notes: string;
  sortOrder: number;
}

export interface InspectionEntry {
  id: string;
  date: string;
  endDate: string;
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

// Budget Management Types
export type BudgetPart = 'PE' | 'IC';
export type BudgetItemCategory = 'item' | 'engineering' | 'contingency' | 'direct_cost';
export type BudgetQuoteStatus = 'assumed' | 'quoting' | 'confirmed';

export type QuotationCurrency = 'KRW' | 'USD' | 'EUR';

export interface BudgetItem {
  id: string;
  part: BudgetPart;
  category: BudgetItemCategory;
  name: string;
  originalBudgetUSD: number;
  originalBudgetKRW: number;
  quotationPrice: number;
  quotationCurrency: QuotationCurrency;
  quotationOriginalPrice: number;
  revisedBudget: number;
  supplier: string;
  rfqDate: string;
  rfqIssued: boolean;
  poDate: string;
  poIssued: boolean;
  expectedDelivery: string;
  requiredDelivery: string;
  remark: string;
  quoteStatus: BudgetQuoteStatus;
  sortOrder: number;
  groupId: string;
}

// Todo List Types
export type TodoPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TodoDefaultCategory = 'mail_write' | 'mail_reply' | 'drawing' | 'eic_request' | 'confirmation' | 'purchase_order' | 'general_request';
export type TodoCategory = TodoDefaultCategory | string;

export interface TodoItem {
  id: string;
  projectId: string;
  title: string;
  memo: string;
  category: TodoCategory;
  priority: TodoPriority;
  dueDate: string;
  dueDateTBD: boolean;
  completed: boolean;
  completedAt: string;
  createdAt: string;
  sortOrder: number;
}

export interface QuickPhrase {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

// Budget Snapshot Types
export interface BudgetSnapshot {
  id: string;
  name: string;
  createdAt: string;
  exchangeRate: number;
  eurExchangeRate: number;
  initialContractAmount: number;
  initialContractAmountUSD: number;
  updatedContractAmount: number;
  updatedContractAmountUSD: number;
  targetGM: number;
  budgetItems: BudgetItem[];
}

// Translation Tool Types
export interface SavedPhrase {
  id: string;
  korean: string;
  english: string;
  category: string;
  createdAt: string;
}

export interface TranslationHistory {
  id: string;
  source: string;
  result: string;
  direction: 'ko-en' | 'en-ko';
  timestamp: string;
}
