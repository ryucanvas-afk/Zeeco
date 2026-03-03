import type { Project } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface BudgetTabProps {
  project: Project;
}

export default function BudgetTab({ project }: BudgetTabProps) {
  const { updateProject } = useProjects();

  const exchangeRate = project.exchangeRate || 1350;
  const budgetKRW = project.budgetKRW || 0;
  const budgetUSD = project.budgetUSD || 0;

  // Calculate spent from purchases
  const allPurchases = project.items.flatMap(i => i.purchases);
  const spentKRW = allPurchases
    .filter(p => p.currency === 'KRW' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const spentUSD = allPurchases
    .filter(p => p.currency === 'USD' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const spentEUR = allPurchases
    .filter(p => p.currency === 'EUR' && p.status !== 'cancelled')
    .reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);

  // Total budget in KRW
  const totalBudgetKRW = budgetKRW + budgetUSD * exchangeRate;
  // Total spent in KRW
  const totalSpentKRW = spentKRW + spentUSD * exchangeRate + spentEUR * exchangeRate * 1.1; // rough EUR estimate
  const remainingKRW = totalBudgetKRW - totalSpentKRW;
  const usagePercent = totalBudgetKRW > 0 ? Math.round((totalSpentKRW / totalBudgetKRW) * 100) : 0;

  return (
    <div className="budget-tab">
      {/* Exchange Rate */}
      <div className="section-card">
        <h3 className="section-title">환율 설정</h3>
        <div className="budget-exchange">
          <span>1 USD = </span>
          <EditableCell
            value={String(exchangeRate)}
            type="number"
            onSave={v => updateProject(project.id, { exchangeRate: Number(v) })}
          />
          <span> KRW</span>
        </div>
      </div>

      {/* Budget Setting */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">예산 (KRW)</div>
          <div className="summary-value summary-value-sm">
            <EditableCell
              value={String(budgetKRW)}
              type="number"
              onSave={v => updateProject(project.id, { budgetKRW: Number(v) })}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>원</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">예산 (USD)</div>
          <div className="summary-value summary-value-sm">
            <EditableCell
              value={String(budgetUSD)}
              type="number"
              onSave={v => updateProject(project.id, { budgetUSD: Number(v) })}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>$</span>
          </div>
        </div>
        <div className="summary-card card-ordered">
          <div className="summary-label">총 예산 (KRW 환산)</div>
          <div className="summary-value summary-value-sm">{totalBudgetKRW.toLocaleString()} 원</div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-label">총 집행액 (KRW 환산)</div>
          <div className="summary-value summary-value-sm">{totalSpentKRW.toLocaleString()} 원</div>
        </div>
        <div className={`summary-card ${remainingKRW >= 0 ? 'card-delivered' : 'card-cost'}`}>
          <div className="summary-label">잔여 예산</div>
          <div className="summary-value summary-value-sm">{remainingKRW.toLocaleString()} 원</div>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="section-card">
        <h3 className="section-title">예산 사용률</h3>
        <div className="budget-usage">
          <div className="progress-bar-bg" style={{ height: 20, borderRadius: 10 }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor: usagePercent > 100 ? '#ef4444' : usagePercent > 80 ? '#f59e0b' : '#10b981',
                height: '100%',
                borderRadius: 10,
              }}
            />
          </div>
          <span className="budget-usage-text">{usagePercent}% 사용</span>
        </div>
      </div>

      {/* Breakdown by Currency */}
      <div className="section-card">
        <h3 className="section-title">통화별 집행 현황</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>통화</th>
                <th>집행액</th>
                <th>KRW 환산</th>
                <th>발주 건수</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td-bold">KRW</td>
                <td>{spentKRW.toLocaleString()} 원</td>
                <td>{spentKRW.toLocaleString()} 원</td>
                <td>{allPurchases.filter(p => p.currency === 'KRW' && p.status !== 'cancelled').length}건</td>
              </tr>
              <tr>
                <td className="td-bold">USD</td>
                <td>${spentUSD.toLocaleString()}</td>
                <td>{(spentUSD * exchangeRate).toLocaleString()} 원</td>
                <td>{allPurchases.filter(p => p.currency === 'USD' && p.status !== 'cancelled').length}건</td>
              </tr>
              {spentEUR > 0 && (
                <tr>
                  <td className="td-bold">EUR</td>
                  <td>€{spentEUR.toLocaleString()}</td>
                  <td>{(spentEUR * exchangeRate * 1.1).toLocaleString()} 원</td>
                  <td>{allPurchases.filter(p => p.currency === 'EUR' && p.status !== 'cancelled').length}건</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Item Breakdown */}
      <div className="section-card">
        <h3 className="section-title">품목별 비용</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>품목</th>
                <th>발주 건수</th>
                <th>비용 (원화)</th>
                <th>비용 (달러)</th>
                <th>KRW 환산 합계</th>
              </tr>
            </thead>
            <tbody>
              {project.items.map(item => {
                const itemKRW = item.purchases.filter(p => p.currency === 'KRW' && p.status !== 'cancelled').reduce((s, p) => s + p.unitPrice * p.quantity, 0);
                const itemUSD = item.purchases.filter(p => p.currency === 'USD' && p.status !== 'cancelled').reduce((s, p) => s + p.unitPrice * p.quantity, 0);
                const itemTotal = itemKRW + itemUSD * exchangeRate;
                return (
                  <tr key={item.id}>
                    <td className="td-bold">{item.name}</td>
                    <td>{item.purchases.filter(p => p.status !== 'cancelled').length}건</td>
                    <td>{itemKRW > 0 ? `${itemKRW.toLocaleString()} 원` : '-'}</td>
                    <td>{itemUSD > 0 ? `$${itemUSD.toLocaleString()}` : '-'}</td>
                    <td className="td-cost">{itemTotal.toLocaleString()} 원</td>
                  </tr>
                );
              })}
              {project.items.length === 0 && (
                <tr><td colSpan={5} className="empty-row">등록된 품목이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
