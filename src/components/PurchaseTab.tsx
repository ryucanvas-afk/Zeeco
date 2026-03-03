import { useState, useRef } from 'react';
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
  scopeOfSupply: '',
  notes: '',
  sortOrder: 0,
};

const purchaseStatusOptions = [
  { value: 'rfq_writing', label: 'RFQ 작성 중' },
  { value: 'internal_approval', label: '내부 결재 중' },
  { value: 'zoe_approval', label: 'ZOE 결재 중' },
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

  const allPurchases = project.items.flatMap(item =>
    item.purchases.map(p => ({ ...p, itemName: item.name, parentItemId: item.id }))
  ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const statusSummary = {
    rfq: allPurchases.filter(p => p.status === 'rfq_writing').length,
    approval: allPurchases.filter(p => p.status === 'internal_approval' || p.status === 'zoe_approval').length,
    ordered: allPurchases.filter(p => p.status === 'po_completed').length,
    manufacturing: allPurchases.filter(p => p.status === 'manufacturing').length,
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

    // Update sortOrder for all purchases per item
    const itemPurchaseMap: Record<string, string[]> = {};
    reordered.forEach((p, idx) => {
      if (!itemPurchaseMap[p.parentItemId]) itemPurchaseMap[p.parentItemId] = [];
      itemPurchaseMap[p.parentItemId].push(p.id);
      updatePurchase(project.id, p.parentItemId, p.id, { sortOrder: idx });
    });

    setDragId(null);
    dragOverRef.current = null;
  };

  return (
    <div className="purchase-tab">
      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{allPurchases.length}</div>
          <div className="summary-label">전체 발주</div>
        </div>
        <div className="summary-card card-pending">
          <div className="summary-value">{statusSummary.rfq}</div>
          <div className="summary-label">RFQ 작성 중</div>
        </div>
        <div className="summary-card card-ordered">
          <div className="summary-value">{statusSummary.ordered}</div>
          <div className="summary-label">발주 완료</div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-value">{statusSummary.manufacturing}</div>
          <div className="summary-label">제작 중</div>
        </div>
        <div className="summary-card card-delivered">
          <div className="summary-value">{statusSummary.delivered}</div>
          <div className="summary-label">납품 완료</div>
        </div>
        <div className="summary-card card-cost">
          <div className="summary-value summary-value-sm">
            {totalCostKRW > 0 && <span>{formatNumber(totalCostKRW)} KRW</span>}
            {totalVATKRW > 0 && <span className="vat-text">VAT: {formatNumber(totalVATKRW)} KRW</span>}
            {totalCostUSD > 0 && <span>${formatNumber(totalCostUSD)} USD</span>}
          </div>
          <div className="summary-label">총 발주 금액</div>
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
              <div className="form-group">
                <label>Terms of Payment</label>
                <input type="text" value={formData.termsOfPayment} onChange={e => setFormData({ ...formData, termsOfPayment: e.target.value })} placeholder="T/T 30 days" />
              </div>
              <div className="form-group full-width">
                <label>Scope of Supply</label>
                <input type="text" value={formData.scopeOfSupply} onChange={e => setFormData({ ...formData, scopeOfSupply: e.target.value })} placeholder="Supply only" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">추가</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </form>
        )}

        <p className="edit-hint">카드를 클릭하여 직접 수정 / 드래그로 순서 변경 가능</p>

        {/* Purchase Cards */}
        <div className="purchase-cards">
          {allPurchases.map(purchase => (
            <div
              key={purchase.id}
              className={`purchase-card ${purchase.status === 'delivered' ? 'purchase-card-done' : ''} ${dragId === purchase.id ? 'purchase-card-dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(purchase.id)}
              onDragOver={e => handleDragOver(e, purchase.id)}
              onDrop={handleDrop}
              onDragEnd={() => setDragId(null)}
            >
              <div className="purchase-card-header">
                <div className="purchase-order-num">
                  <EditableCell
                    value={purchase.orderNumber || ''}
                    onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderNumber', v)}
                    placeholder="발주번호"
                  />
                </div>
                <div className="purchase-name-status">
                  <EditableCell
                    value={purchase.partName}
                    onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'partName', v)}
                  />
                  <EditableCell value={purchase.status} type="select" options={purchaseStatusOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'status', v)} />
                </div>
                <button className="btn-icon btn-danger" onClick={() => deletePurchase(project.id, purchase.parentItemId, purchase.id)} title="삭제">✕</button>
              </div>

              <div className="purchase-card-body">
                <div className="purchase-card-main">
                  <span className="purchase-card-spec">
                    <EditableCell
                      value={purchase.specification}
                      onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'specification', v)}
                      placeholder="사양"
                    />
                  </span>
                </div>

                <div className="purchase-card-grid">
                  <div className="purchase-field">
                    <label>품목</label>
                    <EditableCell
                      value={purchase.parentItemId}
                      type="select"
                      options={itemOptions(project)}
                      onSave={v => {
                        // Move purchase to new item
                        if (v !== purchase.parentItemId) {
                          const purchaseData = { ...purchase };
                          delete (purchaseData as Record<string, unknown>)['itemName'];
                          delete (purchaseData as Record<string, unknown>)['parentItemId'];
                          deletePurchase(project.id, purchase.parentItemId, purchase.id);
                          addPurchase(project.id, v, {
                            orderNumber: purchaseData.orderNumber,
                            partName: purchaseData.partName,
                            specification: purchaseData.specification,
                            quantity: purchaseData.quantity,
                            unit: purchaseData.unit,
                            supplier: purchaseData.supplier,
                            team: purchaseData.team,
                            orderDate: purchaseData.orderDate,
                            expectedDelivery: purchaseData.expectedDelivery,
                            actualDelivery: purchaseData.actualDelivery,
                            status: purchaseData.status as PurchaseStatus,
                            orderAmount: purchaseData.orderAmount,
                            vat: purchaseData.vat,
                            currency: purchaseData.currency,
                            termsOfPayment: purchaseData.termsOfPayment,
                            scopeOfSupply: purchaseData.scopeOfSupply,
                            notes: purchaseData.notes,
                            sortOrder: purchaseData.sortOrder,
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="purchase-field">
                    <label>공급업체</label>
                    <EditableCell value={purchase.supplier} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'supplier', v)} placeholder="-" />
                  </div>
                  <div className="purchase-field">
                    <label>담당 팀</label>
                    <EditableCell value={purchase.team || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'team', v)} placeholder="-" />
                  </div>
                  <div className="purchase-field">
                    <label>수량</label>
                    <span>
                      <EditableCell value={String(purchase.quantity)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'quantity', Number(v))} />
                    </span>
                  </div>
                  <div className="purchase-field">
                    <label>단위</label>
                    <EditableCell value={purchase.unit} type="select" options={unitOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'unit', v)} />
                  </div>
                  <div className="purchase-field">
                    <label>통화</label>
                    <EditableCell value={purchase.currency} type="select" options={currencyOptions} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'currency', v)} />
                  </div>
                  <div className="purchase-field">
                    <label>발주 금액</label>
                    <span className="td-cost">{formatNumber(purchase.orderAmount || 0)} {purchase.currency}</span>
                    <EditableCell value={String(purchase.orderAmount || 0)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderAmount', Number(v))} />
                  </div>
                  <div className="purchase-field">
                    <label>VAT</label>
                    <span className="td-cost">{formatNumber(purchase.vat || 0)} {purchase.currency}</span>
                    <EditableCell value={String(purchase.vat || 0)} type="number" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'vat', Number(v))} />
                  </div>
                  <div className="purchase-field">
                    <label>발주일</label>
                    <EditableCell value={purchase.orderDate} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'orderDate', v)} />
                  </div>
                  <div className="purchase-field">
                    <label>납기 예정 (Delivery Schedule)</label>
                    <EditableCell value={purchase.expectedDelivery} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'expectedDelivery', v)} />
                  </div>
                  <div className="purchase-field">
                    <label>입고일</label>
                    <EditableCell value={purchase.actualDelivery} type="date" onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'actualDelivery', v)} />
                  </div>
                  <div className="purchase-field">
                    <label>Terms of Payment</label>
                    <EditableCell value={purchase.termsOfPayment || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'termsOfPayment', v)} placeholder="-" />
                  </div>
                  <div className="purchase-field full-width">
                    <label>Scope of Supply</label>
                    <EditableCell value={purchase.scopeOfSupply || ''} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'scopeOfSupply', v)} placeholder="-" />
                  </div>
                  <div className="purchase-field full-width">
                    <label>비고</label>
                    <EditableCell value={purchase.notes} onSave={v => handleInlineUpdate(purchase.id, purchase.parentItemId, 'notes', v)} placeholder="메모" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {allPurchases.length === 0 && (
            <p className="empty-message">등록된 발주가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
