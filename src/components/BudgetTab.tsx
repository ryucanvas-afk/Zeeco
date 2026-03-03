import type { Project } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface BudgetTabProps {
  project: Project;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function BudgetTab({ project }: BudgetTabProps) {
  const { updateProject } = useProjects();

  const exchangeRate = project.exchangeRate || 1350;
  const budgetKRW = project.budgetKRW || 0;
  const budgetUSD = project.budgetUSD || 0;
  const targetGM = project.targetGM || 0;
  const currentGM = project.currentGM || 0;
  const engineeringCost = project.engineeringCost || 0;
  const directCost = project.directCost || 0;
  const contingency = project.contingency || 0;

  // Calculate spent from purchases
  const allPurchases = project.items.flatMap(i => i.purchases);
  const spentKRW = allPurchases
    .filter(p => p.currency === 'KRW')
    .reduce((sum, p) => sum + (p.orderAmount || 0), 0);
  const spentUSD = allPurchases
    .filter(p => p.currency === 'USD')
    .reduce((sum, p) => sum + (p.orderAmount || 0), 0);
  const spentEUR = allPurchases
    .filter(p => p.currency === 'EUR')
    .reduce((sum, p) => sum + (p.orderAmount || 0), 0);
  const totalVAT = allPurchases.reduce((sum, p) => {
    const vatKRW = p.currency === 'KRW' ? (p.vat || 0) : (p.vat || 0) * exchangeRate;
    return sum + vatKRW;
  }, 0);

  // Total budget in KRW
  const totalBudgetKRW = budgetKRW + budgetUSD * exchangeRate;
  // Total spent in KRW (purchases + engineering + direct cost + contingency)
  const purchaseSpentKRW = spentKRW + spentUSD * exchangeRate + spentEUR * exchangeRate * 1.1;
  const totalSpentKRW = purchaseSpentKRW + engineeringCost + directCost + contingency;
  const remainingKRW = totalBudgetKRW - totalSpentKRW;
  const usagePercent = totalBudgetKRW > 0 ? Math.round((totalSpentKRW / totalBudgetKRW) * 100) : 0;

  // GM calculations
  const gmAmount = totalBudgetKRW > 0 ? totalBudgetKRW * (currentGM / 100) : 0;
  const targetGMAmount = totalBudgetKRW > 0 ? totalBudgetKRW * (targetGM / 100) : 0;
  const remainingForTargetGM = targetGMAmount - gmAmount;

  return (
    <div className="budget-tab">
      {/* GM Section */}
      <div className="summary-cards">
        <div className="summary-card card-ordered">
          <div className="summary-label">목표 GM (%)</div>
          <div className="summary-value summary-value-sm">
            <EditableCell
              value={String(targetGM)}
              type="number"
              onSave={v => updateProject(project.id, { targetGM: Number(v) })}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>%</span>
          </div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-label">현재 GM (%)</div>
          <div className="summary-value summary-value-sm">
            <EditableCell
              value={String(currentGM)}
              type="number"
              onSave={v => updateProject(project.id, { currentGM: Number(v) })}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>%</span>
          </div>
        </div>
        <div className="summary-card card-pending">
          <div className="summary-label">목표 GM 금액</div>
          <div className="summary-value summary-value-sm">{formatNumber(Math.round(targetGMAmount))} 원</div>
        </div>
        <div className={`summary-card ${remainingForTargetGM >= 0 ? 'card-delivered' : 'card-cost'}`}>
          <div className="summary-label">목표 대비 남은 예상</div>
          <div className="summary-value summary-value-sm">{formatNumber(Math.round(remainingForTargetGM))} 원</div>
        </div>
      </div>

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
          <div className="summary-value summary-value-sm">{formatNumber(totalBudgetKRW)} 원</div>
        </div>
        <div className="summary-card card-shipped">
          <div className="summary-label">총 집행액 (KRW 환산)</div>
          <div className="summary-value summary-value-sm">{formatNumber(Math.round(totalSpentKRW))} 원</div>
        </div>
        <div className={`summary-card ${remainingKRW >= 0 ? 'card-delivered' : 'card-cost'}`}>
          <div className="summary-label">잔여 예산</div>
          <div className="summary-value summary-value-sm">{formatNumber(Math.round(remainingKRW))} 원</div>
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

      {/* Other Costs (Engineering + Direct + Contingency) */}
      <div className="section-card">
        <h3 className="section-title">기타 비용</h3>
        <div className="other-cost-grid">
          <div className="other-cost-item">
            <label>Engineering Hours</label>
            <EditableCell value={String(engineeringCost)} type="number" onSave={v => updateProject(project.id, { engineeringCost: Number(v) })} />
            <span className="eng-unit">원</span>
          </div>
          <div className="other-cost-item">
            <label>Direct Cost</label>
            <EditableCell value={String(directCost)} type="number" onSave={v => updateProject(project.id, { directCost: Number(v) })} />
            <span className="eng-unit">원</span>
          </div>
          <div className="other-cost-item">
            <label>Contingency</label>
            <EditableCell value={String(contingency)} type="number" onSave={v => updateProject(project.id, { contingency: Number(v) })} />
            <span className="eng-unit">원</span>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="section-card">
        <h3 className="section-title">비용 구성 요약</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>금액 (KRW)</th>
                <th>비율</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td-bold">구매 발주</td>
                <td className="td-cost">{formatNumber(Math.round(purchaseSpentKRW))} 원</td>
                <td>{totalSpentKRW > 0 ? Math.round((purchaseSpentKRW / totalSpentKRW) * 100) : 0}%</td>
              </tr>
              <tr>
                <td className="td-bold">Engineering Hours</td>
                <td className="td-cost">{formatNumber(engineeringCost)} 원</td>
                <td>{totalSpentKRW > 0 ? Math.round((engineeringCost / totalSpentKRW) * 100) : 0}%</td>
              </tr>
              <tr>
                <td className="td-bold">Direct Cost</td>
                <td className="td-cost">{formatNumber(directCost)} 원</td>
                <td>{totalSpentKRW > 0 ? Math.round((directCost / totalSpentKRW) * 100) : 0}%</td>
              </tr>
              <tr>
                <td className="td-bold">Contingency</td>
                <td className="td-cost">{formatNumber(contingency)} 원</td>
                <td>{totalSpentKRW > 0 ? Math.round((contingency / totalSpentKRW) * 100) : 0}%</td>
              </tr>
              <tr>
                <td className="td-bold">VAT 합계</td>
                <td className="td-cost">{formatNumber(Math.round(totalVAT))} 원</td>
                <td>-</td>
              </tr>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td>합계</td>
                <td className="td-cost">{formatNumber(Math.round(totalSpentKRW))} 원</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
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
                <td>{formatNumber(spentKRW)} 원</td>
                <td>{formatNumber(spentKRW)} 원</td>
                <td>{allPurchases.filter(p => p.currency === 'KRW').length}건</td>
              </tr>
              <tr>
                <td className="td-bold">USD</td>
                <td>${formatNumber(spentUSD)}</td>
                <td>{formatNumber(spentUSD * exchangeRate)} 원</td>
                <td>{allPurchases.filter(p => p.currency === 'USD').length}건</td>
              </tr>
              {spentEUR > 0 && (
                <tr>
                  <td className="td-bold">EUR</td>
                  <td>&euro;{formatNumber(spentEUR)}</td>
                  <td>{formatNumber(Math.round(spentEUR * exchangeRate * 1.1))} 원</td>
                  <td>{allPurchases.filter(p => p.currency === 'EUR').length}건</td>
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
                const itemKRW = item.purchases.filter(p => p.currency === 'KRW').reduce((s, p) => s + (p.orderAmount || 0), 0);
                const itemUSD = item.purchases.filter(p => p.currency === 'USD').reduce((s, p) => s + (p.orderAmount || 0), 0);
                const itemTotal = itemKRW + itemUSD * exchangeRate;
                return (
                  <tr key={item.id}>
                    <td className="td-bold">{item.name}</td>
                    <td>{item.purchases.length}건</td>
                    <td>{itemKRW > 0 ? `${formatNumber(itemKRW)} 원` : '-'}</td>
                    <td>{itemUSD > 0 ? `$${formatNumber(itemUSD)}` : '-'}</td>
                    <td className="td-cost">{formatNumber(itemTotal)} 원</td>
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
