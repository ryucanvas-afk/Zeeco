import { useState } from 'react';
import type { Project, Purchase, PurchaseStatus } from '../types';
import { useProjects } from '../context/ProjectContext';
import { PurchaseStatusBadge } from './StatusBadge';

interface PurchaseTabProps {
  project: Project;
}

const emptyPurchase: Omit<Purchase, 'id' | 'itemId'> = {
  partName: '',
  specification: '',
  quantity: 0,
  unit: 'EA',
  supplier: '',
  orderDate: '',
  expectedDelivery: '',
  actualDelivery: '',
  status: 'pending',
  unitPrice: 0,
  currency: 'KRW',
  notes: '',
};

export default function PurchaseTab({ project }: PurchaseTabProps) {
  const { addPurchase, updatePurchase, deletePurchase } = useProjects();
  const [selectedItemId, setSelectedItemId] = useState<string>(project.items[0]?.id || '');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyPurchase);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'item'>('all');

  const allPurchases = project.items.flatMap(item =>
    item.purchases.map(p => ({ ...p, itemName: item.name, itemCategory: item.category, parentItemId: item.id }))
  );

  const displayPurchases = viewMode === 'all' ? allPurchases : allPurchases.filter(p => p.parentItemId === selectedItemId);

  const statusSummary = {
    pending: allPurchases.filter(p => p.status === 'pending').length,
    ordered: allPurchases.filter(p => p.status === 'ordered').length,
    shipped: allPurchases.filter(p => p.status === 'shipped').length,
    delivered: allPurchases.filter(p => p.status === 'delivered').length,
  };

  const totalCostKRW = allPurchases.filter(p => p.currency === 'KRW').reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const totalCostUSD = allPurchases.filter(p => p.currency === 'USD').reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    if (editingId) {
      const parentItem = allPurchases.find(p => p.id === editingId);
      if (parentItem) {
        updatePurchase(project.id, parentItem.parentItemId, editingId, formData);
      }
      setEditingId(null);
    } else {
      addPurchase(project.id, selectedItemId, formData);
    }
    setFormData(emptyPurchase);
    setShowForm(false);
  };

  const handleEdit = (purchase: (typeof allPurchases)[0]) => {
    setFormData({
      partName: purchase.partName,
      specification: purchase.specification,
      quantity: purchase.quantity,
      unit: purchase.unit,
      supplier: purchase.supplier,
      orderDate: purchase.orderDate,
      expectedDelivery: purchase.expectedDelivery,
      actualDelivery: purchase.actualDelivery,
      status: purchase.status,
      unitPrice: purchase.unitPrice,
      currency: purchase.currency,
      notes: purchase.notes,
    });
    setSelectedItemId(purchase.parentItemId);
    setEditingId(purchase.id);
    setShowForm(true);
  };

  return (
    <div className="purchase-tab">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-value">{allPurchases.length}</div>
          <div className="summary-label">전체 발주</div>
        </div>
        <div className="summary-card card-pending">
          <div className="summary-value">{statusSummary.pending}</div>
          <div className="summary-label">발주 대기</div>
        </div>
        <div className="summary-card card-ordered">
          <div className="summary-value">{statusSummary.ordered}</div>
          <div className="summary-label">발주 완료</div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-value">{statusSummary.shipped}</div>
          <div className="summary-label">운송 중</div>
        </div>
        <div className="summary-card card-delivered">
          <div className="summary-value">{statusSummary.delivered}</div>
          <div className="summary-label">입고 완료</div>
        </div>
        <div className="summary-card card-cost">
          <div className="summary-value summary-value-sm">
            {totalCostKRW > 0 && <span>{totalCostKRW.toLocaleString()} KRW</span>}
            {totalCostUSD > 0 && <span>${totalCostUSD.toLocaleString()} USD</span>}
          </div>
          <div className="summary-label">총 비용</div>
        </div>
      </div>

      {/* Purchase Table */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">구매 발주 현황</h3>
          <div className="section-actions">
            <div className="toggle-group">
              <button className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>전체</button>
              <button className={`toggle-btn ${viewMode === 'item' ? 'active' : ''}`} onClick={() => setViewMode('item')}>품목별</button>
            </div>
            {viewMode === 'item' && (
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="item-select"
              >
                {project.items.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                ))}
              </select>
            )}
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyPurchase); }}>
              + 발주 추가
            </button>
          </div>
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
                <input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              </div>
              <div className="form-group">
                <label>공급업체</label>
                <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} />
              </div>
              <div className="form-group">
                <label>발주일</label>
                <input type="date" value={formData.orderDate} onChange={e => setFormData({ ...formData, orderDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>납기 예정일</label>
                <input type="date" value={formData.expectedDelivery} onChange={e => setFormData({ ...formData, expectedDelivery: e.target.value })} />
              </div>
              <div className="form-group">
                <label>실제 입고일</label>
                <input type="date" value={formData.actualDelivery} onChange={e => setFormData({ ...formData, actualDelivery: e.target.value })} />
              </div>
              <div className="form-group">
                <label>상태</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as PurchaseStatus })}>
                  <option value="pending">발주 대기</option>
                  <option value="ordered">발주 완료</option>
                  <option value="shipped">운송 중</option>
                  <option value="delivered">입고 완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
              <div className="form-group">
                <label>단가</label>
                <input type="number" value={formData.unitPrice} onChange={e => setFormData({ ...formData, unitPrice: Number(e.target.value) })} min="0" />
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
                <label>비고</label>
                <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{editingId ? '수정' : '추가'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>취소</button>
            </div>
          </form>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {viewMode === 'all' && <th>품목</th>}
                <th>부품명</th>
                <th>사양</th>
                <th>수량</th>
                <th>공급업체</th>
                <th>발주일</th>
                <th>납기 예정</th>
                <th>입고일</th>
                <th>상태</th>
                <th>금액</th>
                <th>비고</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {displayPurchases.map(purchase => (
                <tr key={purchase.id} className={purchase.status === 'delivered' ? 'row-completed' : ''}>
                  {viewMode === 'all' && (
                    <td>
                      <span className="td-item-name">{purchase.itemName}</span>
                    </td>
                  )}
                  <td className="td-bold">{purchase.partName}</td>
                  <td className="td-spec">{purchase.specification}</td>
                  <td>{purchase.quantity} {purchase.unit}</td>
                  <td>{purchase.supplier}</td>
                  <td>{purchase.orderDate || '-'}</td>
                  <td>{purchase.expectedDelivery || '-'}</td>
                  <td>{purchase.actualDelivery || '-'}</td>
                  <td><PurchaseStatusBadge status={purchase.status} /></td>
                  <td className="td-cost">
                    {(purchase.unitPrice * purchase.quantity).toLocaleString()} {purchase.currency}
                  </td>
                  <td className="td-notes">{purchase.notes}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" onClick={() => handleEdit(purchase)} title="수정">✎</button>
                      <button className="btn-icon btn-danger" onClick={() => deletePurchase(project.id, purchase.parentItemId, purchase.id)} title="삭제">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayPurchases.length === 0 && (
                <tr><td colSpan={viewMode === 'all' ? 12 : 11} className="empty-row">등록된 발주가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
