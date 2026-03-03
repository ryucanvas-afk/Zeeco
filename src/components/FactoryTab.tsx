import { useState } from 'react';
import type { Project, FactoryPurchase } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface FactoryTabProps {
  project: Project;
}

const emptyFP: Omit<FactoryPurchase, 'id'> = {
  partName: '',
  supplier: '',
  orderDate: '',
  expectedDelivery: '',
  status: '발주 대기',
  amount: 0,
  currency: 'KRW',
  notes: '',
};

const factoryStatusOptions = [
  { value: '발주 대기', label: '발주 대기' },
  { value: '발주 완료', label: '발주 완료' },
  { value: '제작 중', label: '제작 중' },
  { value: '입고 완료', label: '입고 완료' },
];

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function FactoryTab({ project }: FactoryTabProps) {
  const { addFactoryPurchase, updateFactoryPurchase, deleteFactoryPurchase } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyFP);

  const fps = project.factoryPurchases || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addFactoryPurchase(project.id, formData);
    setFormData(emptyFP);
    setShowForm(false);
  };

  return (
    <div className="factory-tab">
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">공장 관리 - 발주 품목</h3>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormData(emptyFP); }}>+ 품목 추가</button>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>품목명</label>
                <input type="text" value={formData.partName} onChange={e => setFormData({ ...formData, partName: e.target.value })} required />
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
                <label>납기 예정</label>
                <input type="date" value={formData.expectedDelivery} onChange={e => setFormData({ ...formData, expectedDelivery: e.target.value })} />
              </div>
              <div className="form-group">
                <label>금액</label>
                <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} min="0" />
              </div>
              <div className="form-group">
                <label>통화</label>
                <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>비고</label>
                <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">추가</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            </div>
          </form>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>품목명</th>
                <th>공급업체</th>
                <th>발주일</th>
                <th>납기 예정</th>
                <th>상태</th>
                <th>금액</th>
                <th>비고</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {fps.map(fp => (
                <tr key={fp.id}>
                  <td className="td-bold td-white">
                    <EditableCell value={fp.partName} onSave={v => updateFactoryPurchase(project.id, fp.id, { partName: v })} />
                  </td>
                  <td className="td-white">
                    <EditableCell value={fp.supplier || ''} onSave={v => updateFactoryPurchase(project.id, fp.id, { supplier: v })} placeholder="-" />
                  </td>
                  <td className="td-white">
                    <EditableCell value={fp.orderDate || ''} type="date" onSave={v => updateFactoryPurchase(project.id, fp.id, { orderDate: v })} />
                  </td>
                  <td className="td-white">
                    <EditableCell value={fp.expectedDelivery || ''} type="date" onSave={v => updateFactoryPurchase(project.id, fp.id, { expectedDelivery: v })} />
                  </td>
                  <td>
                    <EditableCell value={fp.status} type="select" options={factoryStatusOptions} onSave={v => updateFactoryPurchase(project.id, fp.id, { status: v })} />
                  </td>
                  <td className="td-cost td-white">
                    {formatNumber(fp.amount || 0)} {fp.currency}
                  </td>
                  <td className="td-white">
                    <EditableCell value={fp.notes || ''} onSave={v => updateFactoryPurchase(project.id, fp.id, { notes: v })} placeholder="-" />
                  </td>
                  <td>
                    <button className="btn-icon btn-danger" onClick={() => deleteFactoryPurchase(project.id, fp.id)} title="삭제">✕</button>
                  </td>
                </tr>
              ))}
              {fps.length === 0 && (
                <tr><td colSpan={8} className="empty-row">등록된 공장 발주 품목이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
