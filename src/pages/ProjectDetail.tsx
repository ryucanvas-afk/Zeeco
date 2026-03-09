import { useState, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import EditableCell from '../components/EditableCell';
import { ItemManagementStatusBadge } from '../components/StatusBadge';
import ScheduleTab from '../components/ScheduleTab';
import PurchaseTab from '../components/PurchaseTab';
import BudgetTab from '../components/BudgetTab';
import InspectionTab from '../components/InspectionTab';
import FactoryTab from '../components/FactoryTab';
import type { ItemStatus, ProjectStatus, ProcurementStatus, ItemManagementStatus, DeliveryScheduleEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

type TabType = 'overview' | 'schedule' | 'purchase' | 'budget' | 'inspection' | 'factory';

const ITEM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
];

const projectStatusOptions = [
  { value: 'planning', label: '계획 중' },
  { value: 'in_progress', label: '진행 중' },
  { value: 'completed', label: '완료' },
  { value: 'on_hold', label: '보류' },
];

const managementStatusOptions = [
  { value: 'quoting', label: '견적 중' },
  { value: 'approval', label: '결재 중' },
  { value: 'manufacturing', label: '제작 중' },
  { value: 'delivering', label: '납품 중' },
  { value: 'delivered', label: '납품 완료' },
  { value: 'partial_delivered', label: '부분 납품 완료' },
];

const procurementStatusOptions = [
  { value: 'rfq_writing', label: 'RFQ 작성 중' },
  { value: 'quoting', label: '견적 중' },
  { value: 'quote_comparing', label: '견적 비교 중' },
  { value: 'po_writing', label: '발주서 작성 중' },
  { value: 'internal_approval', label: '내부 결재 중' },
  { value: 'hq_approval', label: '본사 결재 중' },
  { value: 'approved', label: '결재 완료' },
  { value: 'manufacturing', label: '제작 중' },
  { value: 'manufacturing_done', label: '제작 완료' },
  { value: 'delivered', label: '납품 완료' },
];

const purchaseStatusLabels: Record<string, string> = {
  rfq_writing: 'RFQ 작성 중',
  internal_approval: '내부 결재 중',
  zoe_approval: 'ZOE 결재 중',
  po_completed: '발주 완료',
  manufacturing: '제작 중',
  inspecting: '검사 중',
  delivered: '납품 완료',
  partial_delivered: '부분 납품 완료',
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, addItem, updateItem, deleteItem, addSubItem, updateSubItem, deleteSubItem, reorderItems } = useProjects();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddItem, setShowAddItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showAddSubItem, setShowAddSubItem] = useState<string | null>(null);
  const [colorPickerItemId, setColorPickerItemId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const dragOverItemRef = useRef<string | null>(null);
  const [subItemForm, setSubItemForm] = useState({ name: '', specification: '', quantity: 0, unit: 'EA', notes: '' });
  const [itemForm, setItemForm] = useState({
    name: '',
    color: '',
    supplier: '',
    requiredDeliveryDate: '',
    requiredDeliveryTBD: false,
    procurementStatus: 'rfq_writing' as ProcurementStatus,
    managementStatus: 'quoting' as ItemManagementStatus,
    notes: '',
    status: 'not_started' as ItemStatus,
  });

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="not-found">
        <h2>프로젝트를 찾을 수 없습니다.</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>대시보드로 이동</button>
      </div>
    );
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addItem(project.id, itemForm);
    setItemForm({
      name: '', color: '', supplier: '', requiredDeliveryDate: '',
      requiredDeliveryTBD: false,
      procurementStatus: 'rfq_writing', managementStatus: 'quoting', notes: '',
      status: 'not_started',
    });
    setShowAddItem(false);
  };

  const handleAddSubItem = (e: React.FormEvent, itemId: string) => {
    e.preventDefault();
    addSubItem(project.id, itemId, subItemForm);
    setSubItemForm({ name: '', specification: '', quantity: 0, unit: 'EA', notes: '' });
    setShowAddSubItem(null);
  };

  const handleItemDragStart = (itemId: string) => {
    setDragItemId(itemId);
  };

  const handleItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    dragOverItemRef.current = itemId;
  };

  const handleItemDrop = () => {
    if (!project || !dragItemId || !dragOverItemRef.current || dragItemId === dragOverItemRef.current) {
      setDragItemId(null);
      dragOverItemRef.current = null;
      return;
    }
    const ids = project.items.map(i => i.id);
    const fromIdx = ids.indexOf(dragItemId);
    const toIdx = ids.indexOf(dragOverItemRef.current);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragItemId);
    reorderItems(project.id, ids);
    setDragItemId(null);
    dragOverItemRef.current = null;
  };

  const tabs: { key: TabType; label: string; show: boolean }[] = [
    { key: 'overview', label: '품목 관리', show: true },
    { key: 'schedule', label: '일정 관리', show: true },
    { key: 'purchase', label: '구매 관리', show: true },
    { key: 'budget', label: '예산 관리', show: true },
    { key: 'inspection', label: '검사 일정', show: true },
    { key: 'factory', label: '공장 관리', show: !!project.needsFactoryManagement },
  ];

  return (
    <div className="project-detail">
      <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => navigate('/')}>대시보드</button>
        <span className="breadcrumb-sep">/</span>
        <button className="breadcrumb-link" onClick={() => navigate('/projects')}>프로젝트</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{project.name}</span>
      </div>

      <div className="project-header-card" style={{ borderLeft: `4px solid ${project.color || '#3b82f6'}` }}>
        <div className="project-header-info">
          <div className="project-header-title-row">
            <h2><EditableCell value={project.name} onSave={v => updateProject(project.id, { name: v })} /></h2>
            <span className="project-no-label">No. <EditableCell value={project.projectNo || ''} onSave={v => updateProject(project.id, { projectNo: v })} placeholder="프로젝트 번호" /></span>
          </div>
          <p className="project-header-desc">
            <EditableCell value={project.description} onSave={v => updateProject(project.id, { description: v })} placeholder="설명을 입력하세요" />
          </p>
          {/* Header Note - red, large */}
          <div className="project-header-note">
            <EditableCell
              value={project.headerNote || ''}
              onSave={v => updateProject(project.id, { headerNote: v })}
              placeholder="중요 공지사항 입력 (예: SKID & BMS 납기 변경)"
            />
          </div>
          <div className="project-header-meta">
            <EditableCell value={project.status} type="select" options={projectStatusOptions} onSave={v => updateProject(project.id, { status: v as ProjectStatus })} />
            <span>고객사: <EditableCell value={project.client} onSave={v => updateProject(project.id, { client: v })} /></span>
            <span>계약일: <EditableCell value={project.contractDate || ''} type="date" onSave={v => updateProject(project.id, { contractDate: v })} /></span>
            <span>KOM: <EditableCell value={project.komDate || ''} type="date" onSave={v => updateProject(project.id, { komDate: v })} /></span>
            <span>납기일: <EditableCell value={project.deliveryDate || ''} type="date" onSave={v => updateProject(project.id, { deliveryDate: v })} /></span>
            <span>품목: {project.items.length}개</span>
            <label className="factory-check" onClick={e => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={!!project.needsFactoryManagement}
                onChange={e => updateProject(project.id, { needsFactoryManagement: e.target.checked })}
              />
              공장 관리
            </label>
          </div>
          {/* Delivery Schedules - split deliveries */}
          <div className="delivery-schedules">
            <div className="delivery-schedules-header">
              <span className="delivery-schedules-label">분할 납기 일정</span>
              <button className="btn btn-sm btn-secondary" onClick={() => {
                const newEntry: DeliveryScheduleEntry = { id: uuidv4(), label: '', date: '' };
                updateProject(project.id, { deliverySchedules: [...(project.deliverySchedules || []), newEntry] });
              }}>+ 납기 추가</button>
            </div>
            {(project.deliverySchedules || []).length > 0 && (
              <div className="delivery-schedules-list">
                {(project.deliverySchedules || []).map(ds => (
                  <div key={ds.id} className="delivery-schedule-item">
                    <EditableCell
                      value={ds.label}
                      onSave={v => {
                        const updated = (project.deliverySchedules || []).map(d => d.id === ds.id ? { ...d, label: v } : d);
                        updateProject(project.id, { deliverySchedules: updated });
                      }}
                      placeholder="Unit #1"
                    />
                    <span className="delivery-schedule-sep">:</span>
                    <EditableCell
                      value={ds.date}
                      type="date"
                      onSave={v => {
                        const updated = (project.deliverySchedules || []).map(d => d.id === ds.id ? { ...d, date: v } : d);
                        updateProject(project.id, { deliverySchedules: updated });
                      }}
                    />
                    <button className="btn-icon btn-danger" onClick={() => {
                      const updated = (project.deliverySchedules || []).filter(d => d.id !== ds.id);
                      updateProject(project.id, { deliverySchedules: updated });
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.filter(t => t.show).map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="section-card">
              <div className="section-header">
                <h3 className="section-title">품목 목록</h3>
                <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ 품목 추가</button>
              </div>

              {showAddItem && (
                <form className="inline-form" onSubmit={handleAddItem}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>품목명</label>
                      <input type="text" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>발주 업체</label>
                      <input type="text" value={itemForm.supplier} onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>필요 입고 일자</label>
                      <div className="date-tbd-group">
                        {!itemForm.requiredDeliveryTBD && (
                          <input type="date" value={itemForm.requiredDeliveryDate} onChange={e => setItemForm({ ...itemForm, requiredDeliveryDate: e.target.value })} />
                        )}
                        <label className="tbd-check">
                          <input type="checkbox" checked={itemForm.requiredDeliveryTBD} onChange={e => setItemForm({ ...itemForm, requiredDeliveryTBD: e.target.checked, requiredDeliveryDate: e.target.checked ? '' : itemForm.requiredDeliveryDate })} />
                          TBD
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">추가</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddItem(false)}>취소</button>
                  </div>
                </form>
              )}

              <p className="edit-hint">셀을 클릭하여 수정 / 행을 클릭하여 상세 확장 / 색상 원 클릭으로 품목 색상 변경</p>

              <div className="table-wrapper">
                <table className="data-table item-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th style={{ width: 36 }}></th>
                      <th>품목명</th>
                      <th>발주 업체</th>
                      <th>필요 입고 일자</th>
                      <th>상태</th>
                      <th>발주</th>
                      <th>노트</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.items.map(item => {
                      const delivered = item.purchases.filter(p => p.status === 'delivered' || p.status === 'partial_delivered').length;
                      const totalPurchases = item.purchases.length;
                      const deliveryProgress = totalPurchases > 0 ? Math.round((delivered / totalPurchases) * 100) : 0;

                      return (
                        <Fragment key={item.id}>
                          <tr
                            className={`item-row ${expandedItemId === item.id ? 'item-row-expanded' : ''} ${dragItemId === item.id ? 'item-row-dragging' : ''}`}
                            onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                            style={{ borderLeft: `4px solid ${item.color || '#3b82f6'}` }}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleItemDragStart(item.id); }}
                            onDragOver={(e) => handleItemDragOver(e, item.id)}
                            onDrop={(e) => { e.preventDefault(); handleItemDrop(); }}
                            onDragEnd={() => { setDragItemId(null); dragOverItemRef.current = null; }}
                          >
                            <td className="item-drag-handle-cell" onClick={e => e.stopPropagation()}>
                              <span className="item-drag-handle" title="드래그하여 정렬">⠿</span>
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                              <div
                                className="item-color-dot"
                                style={{ backgroundColor: item.color || '#3b82f6' }}
                                onClick={() => setColorPickerItemId(colorPickerItemId === item.id ? null : item.id)}
                              />
                              {colorPickerItemId === item.id && (
                                <div className="item-color-picker">
                                  {ITEM_COLORS.map(c => (
                                    <div
                                      key={c}
                                      className={`color-swatch ${item.color === c ? 'active' : ''}`}
                                      style={{ backgroundColor: c }}
                                      onClick={() => {
                                        updateItem(project.id, item.id, { color: c });
                                        setColorPickerItemId(null);
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="td-bold td-white">
                              <EditableCell value={item.name} onSave={v => updateItem(project.id, item.id, { name: v })} />
                            </td>
                            <td className="td-white">
                              <EditableCell value={item.supplier || ''} onSave={v => updateItem(project.id, item.id, { supplier: v })} placeholder="업체명" />
                            </td>
                            <td className="td-white">
                              {item.requiredDeliveryTBD ? (
                                <span className="tbd-badge" onClick={e => { e.stopPropagation(); updateItem(project.id, item.id, { requiredDeliveryTBD: false }); }}>TBD</span>
                              ) : (
                                <span className="date-with-tbd">
                                  <EditableCell value={item.requiredDeliveryDate || ''} type="date" onSave={v => updateItem(project.id, item.id, { requiredDeliveryDate: v })} />
                                  {!item.requiredDeliveryDate && (
                                    <button className="btn-tbd" onClick={e => { e.stopPropagation(); updateItem(project.id, item.id, { requiredDeliveryTBD: true, requiredDeliveryDate: '' }); }} title="TBD로 변경">TBD</button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td>
                              <EditableCell
                                value={item.managementStatus || 'quoting'}
                                type="select"
                                options={managementStatusOptions}
                                onSave={v => updateItem(project.id, item.id, { managementStatus: v as ItemManagementStatus })}
                              />
                            </td>
                            <td>
                              {totalPurchases > 0 ? (
                                <div className="item-purchase-summary">
                                  <span className="item-purchase-count">{totalPurchases}건</span>
                                  <div className="item-purchase-progress">
                                    <div className="progress-bar-bg" style={{ width: 50, height: 5 }}>
                                      <div className="progress-bar-fill" style={{ width: `${deliveryProgress}%`, backgroundColor: deliveryProgress === 100 ? '#10b981' : item.color || '#3b82f6' }} />
                                    </div>
                                    <span className="item-purchase-pct">{deliveryProgress}%</span>
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                              )}
                            </td>
                            <td className="td-notes td-white">
                              <EditableCell value={item.notes || ''} onSave={v => updateItem(project.id, item.id, { notes: v })} placeholder="메모" />
                            </td>
                            <td>
                              <div className="action-btns" onClick={e => e.stopPropagation()}>
                                <button className="btn-icon btn-danger" onClick={() => deleteItem(project.id, item.id)} title="삭제">✕</button>
                              </div>
                            </td>
                          </tr>
                          {expandedItemId === item.id && (
                            <tr className="item-detail-row">
                              <td colSpan={9}>
                                <div className="item-detail-panel">
                                  <div className="item-detail-full">
                                    <div className="detail-section-header">
                                      <h4>세부 정보 (하부 리스트)</h4>
                                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddSubItem(item.id)}>+ 항목 추가</button>
                                    </div>

                                    {showAddSubItem === item.id && (
                                      <form className="inline-form sub-item-form" onSubmit={e => handleAddSubItem(e, item.id)}>
                                        <div className="form-grid">
                                          <div className="form-group">
                                            <label>항목명</label>
                                            <input type="text" value={subItemForm.name} onChange={e => setSubItemForm({ ...subItemForm, name: e.target.value })} required />
                                          </div>
                                          <div className="form-group">
                                            <label>사양</label>
                                            <input type="text" value={subItemForm.specification} onChange={e => setSubItemForm({ ...subItemForm, specification: e.target.value })} />
                                          </div>
                                          <div className="form-group">
                                            <label>수량</label>
                                            <input type="number" value={subItemForm.quantity} onChange={e => setSubItemForm({ ...subItemForm, quantity: Number(e.target.value) })} min="0" />
                                          </div>
                                          <div className="form-group">
                                            <label>단위</label>
                                            <select value={subItemForm.unit} onChange={e => setSubItemForm({ ...subItemForm, unit: e.target.value })}>
                                              <option value="EA">EA</option>
                                              <option value="SET">SET</option>
                                              <option value="UNIT">UNIT</option>
                                              <option value="ton">ton</option>
                                              <option value="m2">m2</option>
                                              <option value="m">m</option>
                                            </select>
                                          </div>
                                          <div className="form-group">
                                            <label>비고</label>
                                            <input type="text" value={subItemForm.notes} onChange={e => setSubItemForm({ ...subItemForm, notes: e.target.value })} />
                                          </div>
                                        </div>
                                        <div className="form-actions">
                                          <button type="submit" className="btn btn-primary">추가</button>
                                          <button type="button" className="btn btn-secondary" onClick={() => setShowAddSubItem(null)}>취소</button>
                                        </div>
                                      </form>
                                    )}

                                    {(item.subItems || []).length > 0 ? (
                                      <table className="data-table sub-item-table">
                                        <thead>
                                          <tr>
                                            <th>항목명</th>
                                            <th>사양</th>
                                            <th>수량</th>
                                            <th>단위</th>
                                            <th>비고</th>
                                            <th>관리</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(item.subItems || []).map(si => (
                                            <tr key={si.id}>
                                              <td className="td-white">
                                                <EditableCell value={si.name} onSave={v => updateSubItem(project.id, item.id, si.id, { name: v })} />
                                              </td>
                                              <td className="td-white">
                                                <EditableCell value={si.specification || ''} onSave={v => updateSubItem(project.id, item.id, si.id, { specification: v })} placeholder="-" />
                                              </td>
                                              <td className="td-white">
                                                <EditableCell value={String(si.quantity)} type="number" onSave={v => updateSubItem(project.id, item.id, si.id, { quantity: Number(v) })} />
                                              </td>
                                              <td className="td-white">
                                                <EditableCell value={si.unit} type="select" options={[
                                                  { value: 'EA', label: 'EA' }, { value: 'SET', label: 'SET' }, { value: 'UNIT', label: 'UNIT' },
                                                  { value: 'ton', label: 'ton' }, { value: 'm2', label: 'm2' }, { value: 'm', label: 'm' },
                                                ]} onSave={v => updateSubItem(project.id, item.id, si.id, { unit: v })} />
                                              </td>
                                              <td className="td-white">
                                                <EditableCell value={si.notes || ''} onSave={v => updateSubItem(project.id, item.id, si.id, { notes: v })} placeholder="-" />
                                              </td>
                                              <td>
                                                <button className="btn-icon btn-danger" onClick={() => deleteSubItem(project.id, item.id, si.id)} title="삭제">✕</button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <p className="empty-message">등록된 하부 항목이 없습니다.</p>
                                    )}

                                    <div className="detail-grid" style={{ marginTop: 16 }}>
                                      <div className="detail-field">
                                        <label>조달 상태</label>
                                        <EditableCell
                                          value={item.procurementStatus || 'rfq_writing'}
                                          type="select"
                                          options={procurementStatusOptions}
                                          onSave={v => updateItem(project.id, item.id, { procurementStatus: v as ProcurementStatus })}
                                        />
                                      </div>
                                      <div className="detail-field">
                                        <label>관리 상태</label>
                                        <ItemManagementStatusBadge status={item.managementStatus || 'quoting'} />
                                      </div>
                                      <div className="detail-field">
                                        <label>일정 수</label>
                                        <span>{item.schedules.length}건</span>
                                      </div>
                                    </div>

                                    {/* Purchase cards for this item */}
                                    {item.purchases.length > 0 && (
                                      <div style={{ marginTop: 16 }}>
                                        <div className="detail-section-header">
                                          <h4>연동 발주 ({item.purchases.length}건 / 납품 {item.purchases.filter(p => p.status === 'delivered' || p.status === 'partial_delivered').length}건 완료)</h4>
                                        </div>
                                        <div className="item-purchase-cards">
                                          {item.purchases.map(p => (
                                            <div key={p.id} className="item-po-card" style={{ borderLeftColor: item.color || '#3b82f6' }}>
                                              <div className="item-po-header">
                                                <span className="item-po-num">{p.orderNumber || '-'}</span>
                                                <span className="item-po-name">{p.partName}</span>
                                                <span className={`badge ${p.status === 'delivered' ? 'badge-completed' : p.status === 'manufacturing' ? 'badge-mfg' : 'badge-ordered'}`}>
                                                  {purchaseStatusLabels[p.status] || p.status}
                                                </span>
                                              </div>
                                              <div className="item-po-body">
                                                <div className="item-po-row">
                                                  <div className="item-po-field"><label>공급업체</label><span>{p.supplier || '-'}</span></div>
                                                  <div className="item-po-field"><label>담당 팀</label><span>{p.team || '-'}</span></div>
                                                </div>
                                                <div className="item-po-row">
                                                  <div className="item-po-field"><label>수량</label><span>{p.quantity} {p.unit}</span></div>
                                                  <div className="item-po-field"><label>금액</label><span>{formatNumber(p.orderAmount || 0)} {p.currency}</span></div>
                                                </div>
                                                <div className="item-po-row">
                                                  <div className="item-po-field"><label>납기 예정</label><span>{p.expectedDelivery || '-'}</span></div>
                                                  <div className="item-po-field"><label>입고일</label><span>{p.actualDelivery || '-'}</span></div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {project.items.length === 0 && (
                      <tr><td colSpan={9} className="empty-row">등록된 품목이 없습니다. 품목을 추가해주세요.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleTab project={project} />}
        {activeTab === 'purchase' && <PurchaseTab project={project} />}
        {activeTab === 'budget' && <BudgetTab project={project} />}
        {activeTab === 'inspection' && <InspectionTab project={project} />}
        {activeTab === 'factory' && project.needsFactoryManagement && <FactoryTab project={project} />}
      </div>
    </div>
  );
}
