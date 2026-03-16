import { useState, useMemo } from 'react';
import type { Project } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface CashFlowTabProps {
  project: Project;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtCurrency(n: number, currency: string): string {
  if (n === 0) return '-';
  const prefix = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₩';
  return prefix + Math.round(n).toLocaleString();
}

function fmtUSD(n: number): string {
  if (n === 0) return '-';
  return '$' + Math.round(n).toLocaleString();
}

// Convert amount to USD based on currency and exchange rates
function toUSD(amount: number, currency: string, exchangeRate: number, eurRate: number): number {
  if (currency === 'USD') return amount;
  if (currency === 'EUR') return amount * (eurRate / exchangeRate);
  return amount / exchangeRate; // KRW
}

export default function CashFlowTab({ project }: CashFlowTabProps) {
  const {
    addPaymentTerm, updatePaymentTerm, deletePaymentTerm,
    addCashFlowInvoice, updateCashFlowInvoice, deleteCashFlowInvoice,
  } = useProjects();

  const [expandedSection, setExpandedSection] = useState<string | null>('terms');

  const paymentTerms = project.paymentTerms || [];
  const invoices = project.cashFlowInvoices || [];
  const exchangeRate = project.exchangeRate || 1350;
  const eurRate = project.eurExchangeRate || 1500;

  const contractUSD = project.updatedContractAmountUSD || project.initialContractAmountUSD ||
    (project.updatedContractAmount || project.initialContractAmount || 0) / exchangeRate;

  // Gather all purchase payment terms from all purchases across all items
  const purchaseExpenses = useMemo(() => {
    const result: {
      purchaseId: string;
      itemName: string;
      partName: string;
      supplier: string;
      orderAmount: number;
      currency: string;
      termLabel: string;
      percentage: number;
      amount: number;
      amountUSD: number;
      expectedPaymentDate: string;
      actualPaymentDate: string;
      paid: boolean;
    }[] = [];

    for (const item of project.items || []) {
      for (const purchase of item.purchases || []) {
        for (const pt of purchase.purchasePaymentTerms || []) {
          const amt = Math.round((purchase.orderAmount || 0) * pt.percentage / 100);
          // Auto-calc expected payment date if not set
          let epd = pt.expectedPaymentDate;
          if (!epd && pt.expectedInvoiceDate && pt.paymentDueDays > 0) {
            const d = new Date(pt.expectedInvoiceDate);
            d.setDate(d.getDate() + pt.paymentDueDays);
            epd = d.toISOString().split('T')[0];
          }
          result.push({
            purchaseId: purchase.id,
            itemName: item.name,
            partName: purchase.partName,
            supplier: purchase.supplier,
            orderAmount: purchase.orderAmount || 0,
            currency: purchase.currency || 'KRW',
            termLabel: pt.label,
            percentage: pt.percentage,
            amount: amt,
            amountUSD: toUSD(amt, purchase.currency || 'KRW', exchangeRate, eurRate),
            expectedPaymentDate: epd,
            actualPaymentDate: pt.actualPaymentDate,
            paid: pt.paid,
          });
        }
      }
    }
    return result;
  }, [project.items, exchangeRate, eurRate]);

  // Summary calculations
  const totalTermsPct = paymentTerms.reduce((s, t) => s + (t.percentage || 0), 0);
  const totalTermsUSD = paymentTerms.reduce((s, t) => s + (t.amountUSD || 0), 0);
  const totalInvoicedUSD = invoices.reduce((s, inv) => s + (inv.amountUSD || 0), 0);
  const totalReceivedUSD = invoices.reduce((s, inv) => s + (inv.receivedAmount || 0), 0);
  const totalExpenseUSD = purchaseExpenses.reduce((s, e) => s + e.amountUSD, 0);
  const totalPaidUSD = purchaseExpenses.filter(e => e.paid).reduce((s, e) => s + e.amountUSD, 0);

  // Monthly cash flow: contract start + 24 months
  const monthlyData = useMemo(() => {
    // Find earliest date from payment terms or contract date
    const allDates: string[] = [];
    paymentTerms.forEach(t => { if (t.expectedDate) allDates.push(t.expectedDate); });
    invoices.forEach(inv => {
      if (inv.invoiceDate) allDates.push(inv.invoiceDate);
      if (inv.receivedDate) allDates.push(inv.receivedDate);
    });
    purchaseExpenses.forEach(e => {
      if (e.expectedPaymentDate) allDates.push(e.expectedPaymentDate);
      if (e.actualPaymentDate) allDates.push(e.actualPaymentDate);
    });
    if (project.contractDate) allDates.push(project.contractDate);

    if (allDates.length === 0) return [];

    allDates.sort();
    const startDate = new Date(allDates[0]);
    // Start from the earliest month, go 24 months
    const months: { key: string; income: number; expense: number; received: number; paid: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        income: 0, expense: 0, received: 0, paid: 0,
      });
    }

    // Income from payment terms
    paymentTerms.forEach(term => {
      if (term.expectedDate && term.amountUSD) {
        const key = term.expectedDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.income += term.amountUSD;
      }
    });

    // Received from invoices
    invoices.forEach(inv => {
      if (inv.receivedDate && inv.receivedAmount) {
        const key = inv.receivedDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.received += inv.receivedAmount;
      }
    });

    // Expenses from purchase payment terms
    purchaseExpenses.forEach(e => {
      const dateKey = (e.actualPaymentDate || e.expectedPaymentDate || '').substring(0, 7);
      if (dateKey) {
        const m = months.find(x => x.key === dateKey);
        if (m) {
          m.expense += e.amountUSD;
          if (e.paid) m.paid += e.amountUSD;
        }
      }
    });

    return months;
  }, [paymentTerms, invoices, purchaseExpenses, project.contractDate]);

  // Running balance
  const cumulativeData = useMemo(() => {
    let cumIncome = 0, cumExpense = 0, cumReceived = 0, cumPaid = 0;
    return monthlyData.map(m => {
      cumIncome += m.income;
      cumExpense += m.expense;
      cumReceived += m.received;
      cumPaid += m.paid;
      return { ...m, cumIncome, cumExpense, cumReceived, cumPaid, expectedBalance: cumIncome - cumExpense, actualBalance: cumReceived - cumPaid };
    });
  }, [monthlyData]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleAddTerm = () => {
    addPaymentTerm(project.id, { milestone: '', percentage: 0, amountUSD: 0, expectedDate: '', description: '' });
    setExpandedSection('terms');
  };

  const handleAddInvoice = () => {
    addCashFlowInvoice(project.id, { paymentTermId: paymentTerms.length > 0 ? paymentTerms[0].id : '', invoiceNo: '', invoiceDate: '', amountUSD: 0, receivedDate: '', receivedAmount: 0, notes: '' });
    setExpandedSection('invoices');
  };

  const autoCalcTermAmounts = () => {
    if (!contractUSD || totalTermsPct === 0) return;
    paymentTerms.forEach(term => {
      if (term.percentage > 0) updatePaymentTerm(project.id, term.id, { amountUSD: Math.round(contractUSD * term.percentage / 100) });
    });
  };

  const maxBarValue = useMemo(() => {
    if (cumulativeData.length === 0) return 1;
    return Math.max(...cumulativeData.map(d => Math.max(Math.abs(d.cumIncome), Math.abs(d.cumExpense))), 1);
  }, [cumulativeData]);

  return (
    <div className="cashflow-tab">
      {/* Dashboard */}
      <div className="cf-dashboard">
        <div className="cf-dash-card cf-dash-contract">
          <div className="cf-dash-label">계약 금액</div>
          <div className="cf-dash-value">{fmtUSD(contractUSD)}</div>
          <div className="cf-dash-sub">{fmt(contractUSD * exchangeRate)} KRW</div>
        </div>
        <div className="cf-dash-card cf-dash-income">
          <div className="cf-dash-label">예상 수금</div>
          <div className="cf-dash-value">{fmtUSD(totalTermsUSD)}</div>
          <div className="cf-dash-sub">Payment Terms {totalTermsPct}%</div>
        </div>
        <div className="cf-dash-card cf-dash-received">
          <div className="cf-dash-label">실 수금</div>
          <div className="cf-dash-value">{fmtUSD(totalReceivedUSD)}</div>
          <div className="cf-dash-sub">Invoice {invoices.length}건</div>
        </div>
        <div className="cf-dash-card cf-dash-expense">
          <div className="cf-dash-label">총 지출 (발주 연동)</div>
          <div className="cf-dash-value">{fmtUSD(totalExpenseUSD)}</div>
          <div className="cf-dash-sub">집행 {fmtUSD(totalPaidUSD)} / {purchaseExpenses.length}건</div>
        </div>
        <div className="cf-dash-card cf-dash-balance">
          <div className="cf-dash-label">현재 잔액</div>
          <div className="cf-dash-value" style={{ color: totalReceivedUSD - totalPaidUSD >= 0 ? '#10b981' : '#ef4444' }}>
            {fmtUSD(totalReceivedUSD - totalPaidUSD)}
          </div>
          <div className="cf-dash-sub">수금 - 집행</div>
        </div>
      </div>

      {/* Payment Terms (수금 계획) */}
      <div className="cf-section">
        <div className="cf-section-header" onClick={() => setExpandedSection(expandedSection === 'terms' ? null : 'terms')}>
          <h3>{expandedSection === 'terms' ? '▾' : '▸'} Payment Terms / 수금 계획 ({paymentTerms.length}건)</h3>
          <div className="cf-section-actions" onClick={e => e.stopPropagation()}>
            {paymentTerms.length > 0 && totalTermsPct > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={autoCalcTermAmounts}>금액 자동 계산</button>
            )}
            <button className="btn btn-sm btn-primary" onClick={handleAddTerm}>+ 추가</button>
          </div>
        </div>
        {expandedSection === 'terms' && (
          <div className="cf-section-body">
            {paymentTerms.length > 0 ? (
              <table className="data-table cf-table">
                <thead><tr><th>Milestone</th><th style={{width:80}}>비율(%)</th><th style={{width:120}}>금액(USD)</th><th style={{width:130}}>예상 수금일</th><th>비고</th><th style={{width:40}}></th></tr></thead>
                <tbody>
                  {paymentTerms.map(term => (
                    <tr key={term.id}>
                      <td className="td-white"><EditableCell value={term.milestone} onSave={v => updatePaymentTerm(project.id, term.id, { milestone: v })} placeholder="예: 계약금(Advance)" /></td>
                      <td className="td-white"><EditableCell value={String(term.percentage)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { percentage: Number(v) })} /></td>
                      <td className="td-white"><EditableCell value={String(term.amountUSD)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { amountUSD: Number(v) })} /></td>
                      <td className="td-white"><EditableCell value={term.expectedDate} type="date" onSave={v => updatePaymentTerm(project.id, term.id, { expectedDate: v })} /></td>
                      <td className="td-white"><EditableCell value={term.description} onSave={v => updatePaymentTerm(project.id, term.id, { description: v })} placeholder="-" /></td>
                      <td><button className="btn-icon btn-danger" onClick={() => deletePaymentTerm(project.id, term.id)}>✕</button></td>
                    </tr>
                  ))}
                  <tr className="cf-total-row"><td><strong>합계</strong></td><td><strong>{totalTermsPct}%</strong></td><td><strong>{fmtUSD(totalTermsUSD)}</strong></td><td colSpan={3}></td></tr>
                </tbody>
              </table>
            ) : <p className="empty-message">계약 조건에 따른 수금 일정을 추가하세요.</p>}
          </div>
        )}
      </div>

      {/* Invoice / 수금 */}
      <div className="cf-section">
        <div className="cf-section-header" onClick={() => setExpandedSection(expandedSection === 'invoices' ? null : 'invoices')}>
          <h3>{expandedSection === 'invoices' ? '▾' : '▸'} Invoice / 수금 ({invoices.length}건)</h3>
          <div className="cf-section-actions" onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm btn-primary" onClick={handleAddInvoice}>+ 추가</button>
          </div>
        </div>
        {expandedSection === 'invoices' && (
          <div className="cf-section-body">
            {invoices.length > 0 ? (
              <table className="data-table cf-table">
                <thead><tr><th>Payment Term</th><th>Invoice No.</th><th style={{width:110}}>발행일</th><th style={{width:110}}>청구(USD)</th><th style={{width:110}}>수금일</th><th style={{width:110}}>수금(USD)</th><th>비고</th><th style={{width:40}}></th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className={inv.receivedDate ? 'cf-received' : ''}>
                      <td className="td-white"><EditableCell value={inv.paymentTermId} type="select" options={paymentTerms.map(t => ({ value: t.id, label: `${t.milestone} (${t.percentage}%)` }))} onSave={v => updateCashFlowInvoice(project.id, inv.id, { paymentTermId: v })} /></td>
                      <td className="td-white"><EditableCell value={inv.invoiceNo} onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceNo: v })} placeholder="INV-001" /></td>
                      <td className="td-white"><EditableCell value={inv.invoiceDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceDate: v })} /></td>
                      <td className="td-white"><EditableCell value={String(inv.amountUSD)} type="number" onSave={v => updateCashFlowInvoice(project.id, inv.id, { amountUSD: Number(v) })} /></td>
                      <td className="td-white"><EditableCell value={inv.receivedDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedDate: v })} /></td>
                      <td className="td-white"><EditableCell value={String(inv.receivedAmount)} type="number" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedAmount: Number(v) })} /></td>
                      <td className="td-white"><EditableCell value={inv.notes} onSave={v => updateCashFlowInvoice(project.id, inv.id, { notes: v })} placeholder="-" /></td>
                      <td><button className="btn-icon btn-danger" onClick={() => deleteCashFlowInvoice(project.id, inv.id)}>✕</button></td>
                    </tr>
                  ))}
                  <tr className="cf-total-row"><td colSpan={3}><strong>합계</strong></td><td><strong>{fmtUSD(totalInvoicedUSD)}</strong></td><td></td><td><strong>{fmtUSD(totalReceivedUSD)}</strong></td><td colSpan={2}></td></tr>
                </tbody>
              </table>
            ) : <p className="empty-message">등록된 Invoice가 없습니다.</p>}
          </div>
        )}
      </div>

      {/* 지출 (구매 관리 연동) */}
      <div className="cf-section">
        <div className="cf-section-header" onClick={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')}>
          <h3>{expandedSection === 'expenses' ? '▾' : '▸'} 지출 / Expenses - 구매 관리 연동 ({purchaseExpenses.length}건)</h3>
        </div>
        {expandedSection === 'expenses' && (
          <div className="cf-section-body">
            {purchaseExpenses.length > 0 ? (
              <div className="cf-monthly-scroll">
                <table className="data-table cf-table">
                  <thead>
                    <tr>
                      <th>품목</th>
                      <th>발주 품명</th>
                      <th>공급업체</th>
                      <th>구분</th>
                      <th style={{width:60}}>비율</th>
                      <th style={{width:110}}>금액</th>
                      <th style={{width:110}}>금액(USD)</th>
                      <th style={{width:110}}>예정 지급일</th>
                      <th style={{width:50}}>집행</th>
                      <th style={{width:110}}>실 지급일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseExpenses.map((e, idx) => (
                      <tr key={`${e.purchaseId}-${idx}`} className={e.paid ? 'cf-paid' : ''}>
                        <td>{e.itemName}</td>
                        <td>{e.partName}</td>
                        <td>{e.supplier}</td>
                        <td>{e.termLabel}</td>
                        <td>{e.percentage}%</td>
                        <td className="td-cost">{fmtCurrency(e.amount, e.currency)}</td>
                        <td className="td-cost">{fmtUSD(e.amountUSD)}</td>
                        <td>{e.expectedPaymentDate || '-'}</td>
                        <td style={{textAlign:'center'}}>{e.paid ? '✓' : '-'}</td>
                        <td>{e.actualPaymentDate || '-'}</td>
                      </tr>
                    ))}
                    <tr className="cf-total-row">
                      <td colSpan={6}><strong>합계</strong></td>
                      <td><strong>{fmtUSD(totalExpenseUSD)}</strong></td>
                      <td colSpan={2}><strong>집행: {fmtUSD(totalPaidUSD)}</strong></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">구매 관리에서 발주 항목에 Payment Terms를 추가하면 자동으로 연동됩니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Monthly Cash Flow */}
      {cumulativeData.length > 0 && (
        <div className="cf-section">
          <div className="cf-section-header">
            <h3>Monthly Cash Flow ({cumulativeData.length}개월)</h3>
          </div>
          <div className="cf-section-body">
            <div className="cf-monthly-scroll">
              <table className="data-table cf-monthly-table">
                <thead>
                  <tr>
                    <th className="cf-month-col">월</th>
                    {cumulativeData.map(d => (
                      <th key={d.key} className={`cf-month-th ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>
                        {d.key.substring(2).replace('-', '.')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="cf-row-income"><td className="cf-row-label">예상 수금</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.income > 0 ? fmtUSD(d.income) : '-'}</td>)}</tr>
                  <tr className="cf-row-received"><td className="cf-row-label">실 수금</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.received > 0 ? fmtUSD(d.received) : '-'}</td>)}</tr>
                  <tr className="cf-row-expense"><td className="cf-row-label">지출 예정</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.expense > 0 ? fmtUSD(d.expense) : '-'}</td>)}</tr>
                  <tr className="cf-row-paid"><td className="cf-row-label">실 지출</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.paid > 0 ? fmtUSD(d.paid) : '-'}</td>)}</tr>
                  <tr className="cf-row-divider"><td colSpan={cumulativeData.length + 1}></td></tr>
                  <tr className="cf-row-cum-income"><td className="cf-row-label">누적 수금(예상)</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.cumIncome > 0 ? fmtUSD(d.cumIncome) : '-'}</td>)}</tr>
                  <tr className="cf-row-cum-received"><td className="cf-row-label">누적 수금(실)</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.cumReceived > 0 ? fmtUSD(d.cumReceived) : '-'}</td>)}</tr>
                  <tr className="cf-row-cum-expense"><td className="cf-row-label">누적 지출</td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.cumExpense > 0 ? fmtUSD(d.cumExpense) : '-'}</td>)}</tr>
                  <tr className="cf-row-balance"><td className="cf-row-label"><strong>예상 잔액</strong></td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''} style={{color: d.expectedBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 600}}>{fmtUSD(d.expectedBalance)}</td>)}</tr>
                  <tr className="cf-row-actual-balance"><td className="cf-row-label"><strong>실 잔액</strong></td>{cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''} style={{color: d.actualBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700}}>{d.cumReceived > 0 || d.cumPaid > 0 ? fmtUSD(d.actualBalance) : '-'}</td>)}</tr>
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="cf-chart">
              <div className="cf-chart-title">Cash Flow Chart (누적)</div>
              <div className="cf-chart-bars">
                {cumulativeData.map(d => (
                  <div key={d.key} className={`cf-chart-col ${d.key === currentMonthKey ? 'cf-chart-current' : ''}`}>
                    <div className="cf-chart-bar-group">
                      <div className="cf-chart-bar cf-bar-income" style={{height:`${Math.max((d.cumIncome/maxBarValue)*120,2)}px`}} title={`예상수금: ${fmtUSD(d.cumIncome)}`} />
                      <div className="cf-chart-bar cf-bar-received" style={{height:`${Math.max((d.cumReceived/maxBarValue)*120,0)}px`}} title={`실수금: ${fmtUSD(d.cumReceived)}`} />
                      <div className="cf-chart-bar cf-bar-expense" style={{height:`${Math.max((d.cumExpense/maxBarValue)*120,2)}px`}} title={`지출: ${fmtUSD(d.cumExpense)}`} />
                    </div>
                    <div className="cf-chart-label">{d.key.substring(5)}</div>
                  </div>
                ))}
              </div>
              <div className="cf-chart-legend">
                <span className="cf-legend-item"><span className="cf-legend-dot cf-bar-income" /> 예상 수금</span>
                <span className="cf-legend-item"><span className="cf-legend-dot cf-bar-received" /> 실 수금</span>
                <span className="cf-legend-item"><span className="cf-legend-dot cf-bar-expense" /> 누적 지출</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
