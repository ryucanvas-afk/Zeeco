import { useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import EditableCell from '../components/EditableCell';
import { ProcurementStatusBadge } from '../components/StatusBadge';
import ScheduleTab from '../components/ScheduleTab';
import PurchaseTab from '../components/PurchaseTab';
import BudgetTab from '../components/BudgetTab';
import type { ItemStatus, ProjectStatus, ProcurementStatus } from '../types';

type TabType = 'overview' | 'schedule' | 'purchase' | 'budget';

const projectStatusOptions = [
  { value: 'planning', label: '계획 중' },
  { value: 'in_progress', label: '진행 중' },
  { value: 'completed', label: '완료' },
  { value: 'on_hold', label: '보류' },
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, addItem, updateItem, deleteItem } = useProjects();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddItem, setShowAddItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    category: '',
    supplier: '',
    requiredDeliveryDate: '',
    procurementStatus: 'rfq_writing' as ProcurementStatus,
    purchaseOrderDraft: '',
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
      name: '', category: '', supplier: '', requiredDeliveryDate: '',
      procurementStatus: 'rfq_writing', purchaseOrderDraft: '', notes: '',
      status: 'not_started',
    });
    setShowAddItem(false);
  };

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
          <h2><EditableCell value={project.name} onSave={v => updateProject(project.id, { name: v })} /></h2>
          <p className="project-header-desc">
            <EditableCell value={project.description} onSave={v => updateProject(project.id, { description: v })} placeholder="설명을 입력하세요" />
          </p>
          <div className="project-header-meta">
            <EditableCell value={project.status} type="select" options={projectStatusOptions} onSave={v => updateProject(project.id, { status: v as ProjectStatus })} />
            <span>고객사: <EditableCell value={project.client} onSave={v => updateProject(project.id, { client: v })} /></span>
            <span>시작: <EditableCell value={project.startDate} type="date" onSave={v => updateProject(project.id, { startDate: v })} /></span>
            <span>종료: <EditableCell value={project.endDate} type="date" onSave={v => updateProject(project.id, { endDate: v })} /></span>
            <span>품목: {project.items.length}개</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>품목 관리</button>
        <button className={`tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>일정 관리</button>
        <button className={`tab ${activeTab === 'purchase' ? 'active' : ''}`} onClick={() => setActiveTab('purchase')}>구매 관리</button>
        <button className={`tab ${activeTab === 'budget' ? 'active' : ''}`} onClick={() => setActiveTab('budget')}>예산 관리</button>
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
                      <label>카테고리</label>
                      <input type="text" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>발주 업체</label>
                      <input type="text" value={itemForm.supplier} onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>필요 입고 일자</label>
                      <input type="date" value={itemForm.requiredDeliveryDate} onChange={e => setItemForm({ ...itemForm, requiredDeliveryDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">추가</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddItem(false)}>취소</button>
                  </div>
                </form>
              )}

              <p className="edit-hint">셀을 클릭하여 수정 / 행을 클릭하여 상세 확장</p>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>품목명</th>
                      <th>발주 업체</th>
                      <th>필요 입고 일자</th>
                      <th>상태</th>
                      <th>노트</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.items.map(item => (
                      <Fragment key={item.id}>
                        <tr className={`item-row ${expandedItemId === item.id ? 'item-row-expanded' : ''}`} onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
                          <td className="td-bold">
                            <EditableCell value={item.name} onSave={v => updateItem(project.id, item.id, { name: v })} />
                          </td>
                          <td>
                            <EditableCell value={item.supplier || ''} onSave={v => updateItem(project.id, item.id, { supplier: v })} placeholder="업체명" />
                          </td>
                          <td>
                            <EditableCell value={item.requiredDeliveryDate || ''} type="date" onSave={v => updateItem(project.id, item.id, { requiredDeliveryDate: v })} />
                          </td>
                          <td>
                            <EditableCell
                              value={item.procurementStatus || 'rfq_writing'}
                              type="select"
                              options={procurementStatusOptions}
                              onSave={v => updateItem(project.id, item.id, { procurementStatus: v as ProcurementStatus })}
                            />
                          </td>
                          <td className="td-notes">
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
                            <td colSpan={6}>
                              <div className="item-detail-panel">
                                <div className="item-detail-left">
                                  <h4>세부 정보</h4>
                                  <div className="detail-grid">
                                    <div className="detail-field">
                                      <label>카테고리</label>
                                      <EditableCell value={item.category || ''} onSave={v => updateItem(project.id, item.id, { category: v })} placeholder="카테고리" />
                                    </div>
                                    <div className="detail-field">
                                      <label>상태</label>
                                      <ProcurementStatusBadge status={item.procurementStatus || 'rfq_writing'} />
                                    </div>
                                    <div className="detail-field">
                                      <label>일정 수</label>
                                      <span>{item.schedules.length}건</span>
                                    </div>
                                    <div className="detail-field">
                                      <label>발주 수</label>
                                      <span>{item.purchases.length}건</span>
                                    </div>
                                    <div className="detail-field">
                                      <label>진행률</label>
                                      <span>
                                        {item.schedules.length > 0
                                          ? Math.round(item.schedules.reduce((sum, s) => sum + s.progress, 0) / item.schedules.length)
                                          : 0}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="item-detail-right">
                                  <h4>발주서 초안</h4>
                                  <textarea
                                    className="po-draft-textarea"
                                    value={item.purchaseOrderDraft || ''}
                                    onChange={e => updateItem(project.id, item.id, { purchaseOrderDraft: e.target.value })}
                                    placeholder="발주서 초안을 입력하세요..."
                                    rows={8}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {project.items.length === 0 && (
                      <tr><td colSpan={6} className="empty-row">등록된 품목이 없습니다. 품목을 추가해주세요.</td></tr>
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
      </div>
    </div>
  );
}

