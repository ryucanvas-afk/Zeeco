import { useState, useRef, useMemo } from 'react';
import type { Project, Purchase, PurchaseStatus } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';


interface PurchaseTabProps {
  project: Project;
}

const emptyPurchase: Omit<Purchase, 'id' | 'itemId'> = {
  orderNumber: '',
  partName: '',
  specification: '',
  quantity: 0,
  unit: 'EA',
  supplier: '',
  team: '',
  orderDate: '',
  expectedDelivery: '',
  actualDelivery: '',
  status: 'rfq_writing',
  orderAmount: 0,
  vat: 0,
  currency: 'KRW',
  termsOfPayment: '',
  scopeOfSupply: [''],
  notes: '',
  sortOrder: 0,
};

const purchaseStatusOptions = [
  { value: 'rfq_writing', label: 'RFQ 작성 중' },
  { value: 'rfq_requesting', label: '견적 요청 중' },
  { value: 'price_negotiating', label: '금액 협의 중' },
  { value: 'po_writing', label: '발주서 작성 중' },
  { value: 'internal_approval', label: '내부 결재 중' },
  { value: 'zoe_approval', label: 'ZOE 결재 중' },
  { value: 'po_reviewing', label: '발주서 검토 중' },
  { value: 'po_completed', label: '발주 완료' },
  { value: 'manufacturing', label: '제작 중' },
  { value: 'inspecting', label: '검사 중' },
  { value: 'delivered', label: '납품 완료' },
  { value: 'partial_delivered', label: '부분 납품 완료' },
];

const currencyOptions = [
  { value: 'KRW', label: 'KRW' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

const unitOptions = [
  { value: 'EA', label: 'EA' },
  { value: 'SET', label: 'SET' },
  { value: 'UNIT', label: 'UNIT' },
  { value: 'ton', label: 'ton' },
  { value: 'm2', label: 'm2' },
  { value: 'm', label: 'm' },
];

const itemOptions = (project: Project) =>
  project.items.map(item => ({ value: item.id, label: item.name }));

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function PurchaseTab({ project }: PurchaseTabProps) {
  const { addPurchase, updatePurchase, deletePurchase } = useProjects();
  const [selectedItemId, setSelectedItemId] = useState<string>(project.items[0]?.id || '');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyPurchase);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverRef = useRef<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'in_progress' | 'delivered'>('in_progress');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  // Filter states
  const [filterItem, setFilterItem] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allPurchases = project.items.flatMap(item =>
    item.purchases.map(p => ({ ...p, itemName: item.name, parentItemId: item.id, itemColor: item.color || '#3b82f6' }))
  ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // Extract unique values for filter dropdowns
  const uniqueSuppliers = useMemo(() => [...new Set(allPurchases.map(p => p.supplier).filter(Boolean))].sort(), [allPurchases]);
  const uniqueTeams = useMemo(() => [...new Set(allPurchases.map(p => p.team).filter(Boolean))].sort(), [allPurchases]);

  const inProgressPurchases = allPurchases.filter(p => p.status !== 'delivered');
  const deliveredPurchases = allPurchases.filter(p => p.status === 'delivered');

  // Apply filters
  const applyFilters = (purchases: typeof allPurchases) => {
    let result = purchases;
    if (filterItem !== 'all') result = result.filter(p => p.parentItemId === filterItem);
    if (filterSupplier !== 'all') result = result.filter(p => p.supplier === filterSupplier);
    if (filterTeam !== 'all') result = result.filter(p => p.team === filterTeam);
    if (filterStatus !== 'all') result = result.filter(p => p.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.partName.toLowerCase().includes(q) ||
        p.orderNumber.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        p.specification.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    }
    return result;
  };

  const displayedPurchases = applyFilters(activeSubTab === 'all' ? allPurchases : activeSubTab === 'in_progress' ? inProgressPurchases : deliveredPurchases);
  const hasActiveFilters = filterItem !== 'all' || filterSupplier !== 'all' || filterTeam !== 'all' || filterStatus !== 'all' || searchQuery.trim() !== '';
  const resetFilters = () => { setFilterItem('all'); setFilterSupplier('all'); setFilterTeam('all'); setFilterStatus('all'); setSearchQuery(''); };

  const statusSummary = {
    rfq_writing: allPurchases.filter(p => p.status === 'rfq_writing').length,
    rfq_requesting: allPurchases.filter(p => p.status === 'rfq_requesting').length,
    price_negotiating: allPurchases.filter(p => p.status === 'price_negotiating').length,
    internal_approval: allPurchases.filter(p => p.status === 'internal_approval').length,
    zoe_approval: allPurchases.filter(p => p.status === 'zoe_approval').length,
    po_writing: allPurchases.filter(p => p.status === 'po_writing').length,
    po_reviewing: allPurchases.filter(p => p.status === 'po_reviewing').length,
    po_completed: allPurchases.filter(p => p.status === 'po_completed').length,
    manufacturing: allPurchases.filter(p => p.status === 'manufacturing').length,
    inspecting: allPurchases.filter(p => p.status === 'inspecting').length,
    delivered: allPurchases.filter(p => p.status === 'delivered' || p.status === 'partial_delivered').length,
  };

  const totalCostKRW = allPurchases.filter(p => p.currency === 'KRW').reduce((sum, p) => sum + (p.orderAmount || 0), 0);
  const totalCostUSD = allPurchases.filter(p => p.currency === 'USD').reduce((sum, p) => sum + (p.orderAmount || 0), 0);
  const totalVATKRW = allPurchases.filter(p => p.currency === 'KRW').reduce((sum, p) => sum + (p.vat || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    addPurchase(project.id, selectedItemId, formData);
    setFormData(emptyPurchase);
    setShowForm(false);
  };

  const handleInlineUpdate = (purchaseId: string, parentItemId: string, field: string, value: string | number) => {
    updatePurchase(project.id, parentItemId, purchaseId, { [field]: value });
  };

  const handleDragStart = (purchaseId: string) => {
    setDragId(purchaseId);
  };

  const handleDragOver = (e: React.DragEvent, purchaseId: string) => {
    e.preventDefault();
    dragOverRef.current = purchaseId;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId || !dragOverRef.current || dragId === dragOverRef.current) {
      setDragId(null);
      return;
    }

    const fromIdx = allPurchases.findIndex(p => p.id === dragId);
    const toIdx = allPurchases.findIndex(p => p.id === dragOverRef.current);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...allPurchases];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    reordered.forEach((p, idx) => {
      updatePurchase(project.id, p.parentItemId, p.id, { sortOrder: idx });
    });

    setDragId(null);
    dragOverRef.current = null;
  };

  return (
    <div className="purchase-tab">
      {/* Dashboard Header */}
      <div className="purchase-dashboard">
        {/* Top row: Total + Cost */}
        <div className="purchase-dashboard-top">
          <div className="purchase-total-card" onClick={() => { setActiveSubTab('all'); resetFilters(); }}>
            <div className="purchase-total-value">{allPurchases.length}</div>
            <div className="purchase-total-label">전체 발주</div>
          </div>
          <div className="purchase-cost-card">
            <div className="purchase-cost-values">
              {totalCostKRW > 0 && <span className="purchase-cost-line">{formatNumber(totalCostKRW)} KRW</span>}
              {totalVATKRW > 0 && <span className="purchase-cost-line purchase-cost-vat">VAT: {formatNumber(totalVATKRW)} KRW</span>}
              {totalCostUSD > 0 && <span className="purchase-cost-line">${formatNumber(totalCostUSD)} USD</span>}
            </div>
            <div className="purchase-total-label">총 발주 금액</div>
          </div>
        </div>

        {/* Process Roadmap Flow */}
        <div className="purchase-roadmap">
          {[
            { key: 'rfq_writing', label: 'RFQ 작성', count: statusSummary.rfq_writing, phase: 'prepare' },
            { key: 'rfq_requesting', label: '견적 요청', count: statusSummary.rfq_requesting, phase: 'prepare' },
            { key: 'price_negotiating', label: '금액 협의', count: statusSummary.price_negotiating, phase: 'prepare' },
            { key: 'po_writing', label: '발주서 작성', count: statusSummary.po_writing, phase: 'prepare' },
            { key: 'internal_approval', label: '내부 결재', count: statusSummary.internal_approval, phase: 'approval' },
            { key: 'zoe_approval', label: 'ZOE 결재', count: statusSummary.zoe_approval, phase: 'approval' },
            { key: 'po_reviewing', label: '발주서 검토', count: statusSummary.po_reviewing, phase: 'approval' },
            { key: 'po_completed', label: '발주 완료', count: statusSummary.po_completed, phase: 'ordered' },
            { key: 'manufacturing', label: '제작 중', count: statusSummary.manufacturing, phase: 'production' },
            { key: 'inspecting', label: '검사 중', count: statusSummary.inspecting, phase: 'production' },
            { key: 'delivered', label: '납품 완료', count: statusSummary.delivered, phase: 'done' },
          ].map((step, idx, arr) => (
            <div key={step.key} className="purchase-roadmap-step-wrap">
              <div
                className={`purchase-roadmap-step roadmap-phase-${step.phase} ${step.count > 0 ? 'roadmap-active' : ''}`}
                onClick={() => {
                  if (step.key === 'delivered') { setActiveSubTab('delivered'); resetFilters(); }
                  else { setActiveSubTab('in_progress'); resetFilters(); setFilterStatus(step.key); }
                }}
              >
                <div className="roadmap-step-count">{step.count}</div>
                <div className="roadmap-step-label">{step.label}</div>
              </div>
              {idx < arr.length - 1 && <div className="roadmap-arrow">&#9654;</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Add Form */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">구매 발주 현황</h3>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormData(emptyPurchase); }}>+ 발주 추가</button>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>품목 선택</label>
                <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                  {project.items.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>발주 넘버</label>
                <input type="text" value={formData.orderNumber} onChange={e => setFormData({ ...formData, orderNumber: e.target.value })} placeholder="PO-2026-XXX" />
              </div>
              <div className="form-group">
                <label>부품명</label>
                <input type="text" value={formData.partName} onChange={e => setFormData({ ...formData, partName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>사양</label>
                <input type="text" value={formData.specification} onChange={e => setFormData({ ...formData, specification: e.target.value })} />
              </div>
              <div className="form-group">
                <label>수량</label>
                <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} min="0" required />
              </div>
              <div className="form-group">
                <label>단위</label>
                <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="EA">EA</option>
                  <option value="SET">SET</option>
                  <option value="UNIT">UNIT</option>
                  <option value="ton">ton</option>
                  <option value="m2">m2</option>
                </select>
              </div>
              <div className="form-group">
                <label>공급업체</label>
                <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} />
              </div>
              <div className="form-group">
                <label>담당 팀</label>
                <input type="text" value={formData.team} onChange={e => setFormData({ ...formData, team: e.target.value })} />
              </div>
              <div className="form-group">
                <label>발주 금액</label>
                <input type="number" value={formData.orderAmount} onChange={e => setFormData({ ...formData, orderAmount: Number(e.target.value) })} min="0" />
              </div>
              <div className="form-group">
                <label>VAT</label>
                <input type="number" value={formData.vat} onChange={e => setFormData({ ...formData, vat: Number(e.target.value) })} min="0" />
              </div>
              <div className="form-group">
                <label>통화</label>
                <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>Terms of Payment</label>
                <input type="text" value={formData.termsOfPayment} onChange={e => setFormData({ ...formData, termsOfPayment: e.target.value })} placeholder="T/T 30 days" />
              </div>
              <div className="form-group full-width">
                <label>Scope of Supply</label>
                <div className="scope-list">
                  {formData.scopeOfSupply.map((item, idx) => (
                    <div key={idx} className="scope-list-item">
                      <span className="scope-number">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item}
                        onChange={e => {
                          const updated = [...formData.scopeOfSupply];
                          updated[idx] = e.target.value;
                          setFormData({ ...formData, scopeOfSupply: updated });
                        }}
                        placeholder={`항목 ${idx + 1}`}
                      />
                      {formData.scopeOfSupply.length > 1 && (
                        <button type="button" className="btn-icon btn-danger" onClick={() => {
                          const updated = formData.scopeOfSupply.filter((_, i) => i !== idx);
                          setFormData({ ...formData, scopeOfSupply: updated });
                        }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFormData({ ...formData, scopeOfSupply: [...formData.scopeOfSupply, ''] })}>+ 항목 추가</button>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">추가</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </form>
        )}

        {/* Sub-tab toggle */}
        <div className="purchase-sub-tabs">
          <button
            className={`purchase-sub-tab ${activeSubTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('all')}
          >
            전체<span className="tab-count">{allPurchases.length}</span>
          </button>
          <button
            className={`purchase-sub-tab ${activeSubTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('in_progress')}
          >
            진행 중<span className="tab-count">{inProgressPurchases.length}</span>
          </button>
          <button
            className={`purchase-sub-tab ${activeSubTab === 'delivered' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('delivered')}
          >
            납품 완료<span className="tab-count">{deliveredPurchases.length}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="purchase-filters">
          <div className="purchase-filter-row">
            <div className="purchase-search">
              <input
                type="text"
                placeholder="발주 검색 (부품명, 발주번호, 공급업체...)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="purchase-search-input"
              />
              {searchQuery && (
                <button className="purchase-search-clear" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>
            <select value={filterItem} onChange={e => setFilterItem(e.target.value)} className="purchase-filter-select">
              <option value="all">전체 품목</option>
              {project.items.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="purchase-filter-select">
              <option value="all">전체 공급업체</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="purchase-filter-select">
              <option value="all">전체 담당팀</option>
              {uniqueTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="purchase-filter-select">
              <option value="all">전체 상태</option>
              {purchaseStatusOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button className="btn btn-sm btn-ghost" onClick={resetFilters}>필터 초기화</button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="purchase-filter-result">
              {displayedPurchases.length}건 표시 (전체 {activeSubTab === 'all' ? allPurchases.length : activeSubTab === 'in_progress' ? inProgressPurchases.length : deliveredPurchases.length}건 중)
            </div>
          )}
        </div>

        <p className="edit-hint">항목을 클릭하면 우측에 세부 내용이 표시됩니다</p>

        {/* List + Detail Layout */}
        <div className="purchase-layout">
          {/* Left: Purchase List */}
          <div className="purchase-list-panel">
            {displayedPurchases.map(purchase => {
              const statusLabel = purchaseStatusOptions.find(s => s.value === purchase.status)?.label || purchase.status;
              const isSelected = selectedPurchaseId === purchase.id;
              return (
                <div
                  key={purchase.id}
                  className={`purchase-list-item ${isSelected ? 'purchase-list-item-active' : ''} ${dragId === purchase.id ? 'purchase-card-dragging' : ''}`}
                  style={{ borderLeft: `4px solid ${purchase.itemColor}` }}
                  onClick={() => setSelectedPurchaseId(purchase.id)}
                  draggable
                  onDragStart={() => handleDragStart(purchase.id)}
                  onDragOver={e => handleDragOver(e, purchase.id)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDragId(null)}
                >
                  <div className="purchase-list-item-top">
                    <span className="purchase-list-ordernum">{purchase.orderNumber || '-'}</span>
                    <span className="purchase-list-name">{purchase.partName || '부품명 없음'}</span>
                    <span className={`purchase-list-status purchase-status-${purchase.status}`}>{statusLabel}</span>
                  </div>
                  <div className="purchase-list-item-bottom">
                    <span className="purchase-list-supplier">{purchase.supplier || '-'}</span>
                    <span className="purchase-list-amount">{purchase.orderAmount ? `${formatNumber(purchase.orderAmount)} ${purchase.currency}` : '-'}</span>
                  </div>
                  <button className="purchase-list-delete" onClick={e => { e.stopPropagation(); deletePurchase(project.id, purchase.parentItemId, purchase.id); if (selectedPurchaseId === purchase.id) setSelectedPurchaseId(null); }} title="삭제">×</button>
                </div>
              );
            })}
            {displayedPurchases.length === 0 && (
              <p className="empty-message">{activeSubTab === 'all' ? '등록된 발주가 없습니다.' : activeSubTab === 'in_progress' ? '진행 중인 발주가 없습니다.' : '납품 완료된 발주가 없습니다.'}</p>
            )}
          </div>

          {/* Right: Detail Panel */}
          <div className="purchase-detail-panel">
            {(() => {
              const purchase = displayedPurchases.find(p => p.id === selectedPurchaseId);
              if (!purchase) return (
                <div className="purchase-detail-placeholder">
                  <div className="purchase-detail-placeholder-icon">&#128230;</div>
                  <p>좌측 목록에서 발주를 선택하면<br />세부 내용이 여기에 표시됩니다.</p>
                </div>
              );
              return (
                <div className="purchase-detail-content">
                  <div className="purchase-detail-header">
                    <h4>{purchase.partName || '부품명 없음'}</h4>
                    <EditableCell value={purchase.status} type="select" options={purchaseStatusOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'status', v)} />
                  </div>

                  <div className="purchase-detail-grid">
                    <div className="pd-field"><label>발주번호</label>
                      <EditableCell value={purchase.orderNumber || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderNumber', v)} placeholder="-" />
                    </div>
                    <div className="pd-field"><label>부품명</label>
                      <EditableCell value={purchase.partName} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'partName', v)} />
                    </div>
                    <div className="pd-field"><label>사양</label>
                      <EditableCell value={purchase.specification} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'specification', v)} placeholder="-" />
                    </div>
                    <div className="pd-field"><label>품목</label>
                      <EditableCell value={purchase.parentItemId} type="select" options={itemOptions(project)}
                        onSave={v => {
                          if (v !== purchase.parentItemId) {
                            const pd = { ...purchase };
                            delete (pd as Record<string, unknown>)['itemName'];
                            delete (pd as Record<string, unknown>)['parentItemId'];
                            delete (pd as Record<string, unknown>)['itemColor'];
                            deletePurchase(project.id, purchase.parentItemId, purchase.id);
                            addPurchase(project.id, v, {
                              orderNumber: pd.orderNumber, partName: pd.partName, specification: pd.specification,
                              quantity: pd.quantity, unit: pd.unit, supplier: pd.supplier, team: pd.team,
                              orderDate: pd.orderDate, expectedDelivery: pd.expectedDelivery, actualDelivery: pd.actualDelivery,
                              status: pd.status as PurchaseStatus, orderAmount: pd.orderAmount, vat: pd.vat,
                              currency: pd.currency, termsOfPayment: pd.termsOfPayment, scopeOfSupply: pd.scopeOfSupply,
                              notes: pd.notes, sortOrder: pd.sortOrder,
                            });
                            setSelectedPurchaseId(null);
                          }
                        }}
                      />
                    </div>
                    <div className="pd-field"><label>공급업체</label>
                      <EditableCell value={purchase.supplier} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'supplier', v)} placeholder="-" />
                    </div>
                    <div className="pd-field"><label>담당 팀</label>
                      <EditableCell value={purchase.team || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'team', v)} placeholder="-" />
                    </div>
                    <div className="pd-field"><label>수량</label>
                      <EditableCell value={String(purchase.quantity)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'quantity', Number(v))} />
                    </div>
                    <div className="pd-field"><label>단위</label>
                      <EditableCell value={purchase.unit} type="select" options={unitOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'unit', v)} />
                    </div>
                    <div className="pd-field"><label>통화</label>
                      <EditableCell value={purchase.currency} type="select" options={currencyOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'currency', v)} />
                    </div>
                    <div className="pd-field"><label>발주 금액</label>
                      <span className="td-cost">{formatNumber(purchase.orderAmount || 0)} {purchase.currency}</span>
                      <EditableCell value={String(purchase.orderAmount || 0)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderAmount', Number(v))} />
                    </div>
                    <div className="pd-field"><label>VAT</label>
                      <span className="td-cost">{formatNumber(purchase.vat || 0)} {purchase.currency}</span>
                      <EditableCell value={String(purchase.vat || 0)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'vat', Number(v))} />
                    </div>
                    <div className="pd-field"><label>발주일</label>
                      <EditableCell value={purchase.orderDate} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderDate', v)} />
                    </div>
                    <div className="pd-field"><label>납기 예정</label>
                      <EditableCell value={purchase.expectedDelivery} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'expectedDelivery', v)} />
                    </div>
                    <div className="pd-field"><label>입고일</label>
                      <EditableCell value={purchase.actualDelivery} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'actualDelivery', v)} />
                    </div>
                    <div className="pd-field pd-field-full"><label>Terms of Payment</label>
                      <EditableCell value={purchase.termsOfPayment || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'termsOfPayment', v)} placeholder="-" />
                    </div>
                    <div className="pd-field pd-field-full"><label>Scope of Supply</label>
                      <div className="scope-list">
                        {(Array.isArray(purchase.scopeOfSupply) ? purchase.scopeOfSupply : [purchase.scopeOfSupply || '']).map((item, idx) => (
                          <div key={idx} className="scope-list-item">
                            <span className="scope-number">{idx + 1}.</span>
                            <EditableCell value={item} onSave={v => {
                              const cur = Array.isArray(purchase.scopeOfSupply) ? [...purchase.scopeOfSupply] : [purchase.scopeOfSupply || ''];
                              cur[idx] = v;
                              updatePurchase(project.id, purchase.parentItemId, purchase.id, { scopeOfSupply: cur });
                            }} placeholder={`항목 ${idx + 1}`} />
                            {(Array.isArray(purchase.scopeOfSupply) ? purchase.scopeOfSupply : [purchase.scopeOfSupply || '']).length > 1 && (
                              <button className="btn-icon btn-danger" onClick={() => {
                                const cur = Array.isArray(purchase.scopeOfSupply) ? [...purchase.scopeOfSupply] : [purchase.scopeOfSupply || ''];
                                cur.splice(idx, 1);
                                updatePurchase(project.id, purchase.parentItemId, purchase.id, { scopeOfSupply: cur });
                              }}>✕</button>
                            )}
                          </div>
                        ))}
                        <button className="btn btn-sm btn-secondary" onClick={() => {
                          const cur = Array.isArray(purchase.scopeOfSupply) ? [...purchase.scopeOfSupply] : [purchase.scopeOfSupply || ''];
                          cur.push('');
                          updatePurchase(project.id, purchase.parentItemId, purchase.id, { scopeOfSupply: cur });
                        }}>+ 항목 추가</button>
                      </div>
                    </div>
                    <div className="pd-field pd-field-full"><label>비고</label>
                      <EditableCell value={purchase.notes} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'notes', v)} placeholder="메모" />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
