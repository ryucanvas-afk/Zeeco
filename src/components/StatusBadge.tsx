import type { ProjectStatus, ItemStatus, PurchaseStatus } from '../types';

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
  pending: { label: '발주 대기', className: 'badge-planning' },
  ordered: { label: '발주 완료', className: 'badge-ordered' },
  shipped: { label: '운송 중', className: 'badge-progress' },
  delivered: { label: '입고 완료', className: 'badge-completed' },
  cancelled: { label: '취소', className: 'badge-hold' },
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
  const info = purchaseStatusMap[status];
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
