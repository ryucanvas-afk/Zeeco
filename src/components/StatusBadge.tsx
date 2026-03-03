import type { ProjectStatus, ItemStatus, PurchaseStatus, ProcurementStatus, ItemManagementStatus } from '../types';

const projectStatusMap: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: '계획 중', className: 'badge-planning' },
  in_progress: { label: '진행 중', className: 'badge-progress' },
  completed: { label: '완료', className: 'badge-completed' },
  on_hold: { label: '보류', className: 'badge-hold' },
};

const itemStatusMap: Record<ItemStatus, { label: string; className: string }> = {
  not_started: { label: '미착수', className: 'badge-planning' },
  in_progress: { label: '진행 중', className: 'badge-progress' },
  completed: { label: '완료', className: 'badge-completed' },
  delayed: { label: '지연', className: 'badge-delayed' },
};

const purchaseStatusMap: Record<PurchaseStatus, { label: string; className: string }> = {
  rfq_writing: { label: 'RFQ 작성 중', className: 'badge-planning' },
  internal_approval: { label: '내부 결재 중', className: 'badge-progress' },
  zoe_approval: { label: 'ZOE 결재 중', className: 'badge-progress' },
  po_completed: { label: '발주 완료', className: 'badge-ordered' },
  manufacturing: { label: '제작 중', className: 'badge-mfg' },
  inspecting: { label: '검사 중', className: 'badge-mfg-done' },
  delivered: { label: '납품 완료', className: 'badge-completed' },
  partial_delivered: { label: '부분 납품 완료', className: 'badge-partial' },
};

const procurementStatusMap: Record<ProcurementStatus, { label: string; className: string }> = {
  rfq_writing: { label: 'RFQ 작성 중', className: 'badge-planning' },
  quoting: { label: '견적 중', className: 'badge-planning' },
  quote_comparing: { label: '견적 비교 중', className: 'badge-progress' },
  po_writing: { label: '발주서 작성 중', className: 'badge-progress' },
  internal_approval: { label: '내부 결재 중', className: 'badge-progress' },
  hq_approval: { label: '본사 결재 중', className: 'badge-progress' },
  approved: { label: '결재 완료', className: 'badge-ordered' },
  manufacturing: { label: '제작 중', className: 'badge-mfg' },
  manufacturing_done: { label: '제작 완료', className: 'badge-mfg-done' },
  delivered: { label: '납품 완료', className: 'badge-completed' },
};

const itemManagementStatusMap: Record<ItemManagementStatus, { label: string; className: string }> = {
  quoting: { label: '견적 중', className: 'badge-planning' },
  approval: { label: '결재 중', className: 'badge-progress' },
  manufacturing: { label: '제작 중', className: 'badge-mfg' },
  delivering: { label: '납품 중', className: 'badge-mfg-done' },
  delivered: { label: '납품 완료', className: 'badge-completed' },
  partial_delivered: { label: '부분 납품 완료', className: 'badge-partial' },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const info = projectStatusMap[status];
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const info = itemStatusMap[status];
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const info = purchaseStatusMap[status] || { label: status, className: 'badge-planning' };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export function ProcurementStatusBadge({ status }: { status: ProcurementStatus }) {
  const info = procurementStatusMap[status] || { label: status, className: 'badge-planning' };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}

export function ItemManagementStatusBadge({ status }: { status: ItemManagementStatus }) {
  const info = itemManagementStatusMap[status] || { label: status, className: 'badge-planning' };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
