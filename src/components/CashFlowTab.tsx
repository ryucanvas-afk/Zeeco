import { useState, useMemo } from 'react';
import type { Project, CashFlowExpense } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface CashFlowTabProps {
  project: Project;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtUSD(n: number): string {
  if (n === 0) return '-';
  return '$' + Math.round(n).toLocaleString();
}

const EXPENSE_CATEGORIES = [
  { value: 'material', label: '자재비' },
  { value: 'engineering', label: '설계비' },
  { value: 'direct_cost', label: '직접경비' },
  { value: 'contingency', label: '예비비' },
  { value: 'other', label: '기타' },
];

export default function CashFlowTab({ project }: CashFlowTabProps) {
  const {
    addPaymentTerm, updatePaymentTerm, deletePaymentTerm,
    addCashFlowInvoice, updateCashFlowInvoice, deleteCashFlowInvoice,
    addCashFlowExpense, updateCashFlowExpense, deleteCashFlowExpense,
  } = useProjects();

  const [expandedSection, setExpandedSection] = useState<'terms' | 'invoices' | 'expenses' | null>('terms');

  const paymentTerms = project.paymentTerms || [];
  const invoices = project.cashFlowInvoices || [];
  const expenses = project.cashFlowExpenses || [];

  // Contract amount (prefer USD, fallback to KRW converted)
  const exchangeRate = project.exchangeRate || 1350;
  const contractUSD = project.updatedContractAmountUSD || project.initialContractAmountUSD ||
    (project.updatedContractAmount || project.initialContractAmount || 0) / exchangeRate;

  // Summary calculations
  const totalTermsPct = paymentTerms.reduce((s, t) => s + (t.percentage || 0), 0);
  const totalTermsUSD = paymentTerms.reduce((s, t) => s + (t.amountUSD || 0), 0);
  const totalInvoicedUSD = invoices.reduce((s, inv) => s + (inv.amountUSD || 0), 0);
  const totalReceivedUSD = invoices.reduce((s, inv) => s + (inv.receivedAmount || 0), 0);
  const totalExpensesUSD = expenses.reduce((s, exp) => s + (exp.amountUSD || 0), 0);
  const totalPaidUSD = expenses.filter(e => e.paid).reduce((s, exp) => s + (exp.amountUSD || 0), 0);

  // Monthly cash flow data
  const monthlyData = useMemo(() => {
    const months = new Map<string, { income: number; expense: number; received: number; paid: number }>();

    // Get date range: earliest to latest across all data
    const allDates: string[] = [];
    invoices.forEach(inv => {
      if (inv.invoiceDate) allDates.push(inv.invoiceDate);
      if (inv.receivedDate) allDates.push(inv.receivedDate);
    });
    expenses.forEach(exp => {
      if (exp.expectedDate) allDates.push(exp.expectedDate);
      if (exp.actualDate) allDates.push(exp.actualDate);
    });
    paymentTerms.forEach(t => {
      if (t.expectedDate) allDates.push(t.expectedDate);
    });

    if (allDates.length === 0) return [];

    allDates.sort();
    const startDate = new Date(allDates[0]);
    const endDate = new Date(allDates[allDates.length - 1]);

    // Extend range by 1 month each side
    startDate.setMonth(startDate.getMonth() - 1);
    endDate.setMonth(endDate.getMonth() + 1);

    // Initialize months
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      months.set(key, { income: 0, expense: 0, received: 0, paid: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }

    // Expected income from payment terms
    paymentTerms.forEach(term => {
      if (term.expectedDate && term.amountUSD) {
        const key = term.expectedDate.substring(0, 7);
        const m = months.get(key);
        if (m) m.income += term.amountUSD;
      }
    });

    // Actual received from invoices
    invoices.forEach(inv => {
      if (inv.receivedDate && inv.receivedAmount) {
        const key = inv.receivedDate.substring(0, 7);
        const m = months.get(key);
        if (m) m.received += inv.receivedAmount;
      }
    });

    // Expected expense
    expenses.forEach(exp => {
      const dateKey = (exp.actualDate || exp.expectedDate || '').substring(0, 7);
      if (dateKey) {
        const m = months.get(dateKey);
        if (m) {
          m.expense += exp.amountUSD;
          if (exp.paid) m.paid += exp.amountUSD;
        }
      }
    });

    return [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [paymentTerms, invoices, expenses]);

  // Running balance
  const cumulativeData = useMemo(() => {
    let cumIncome = 0;
    let cumExpense = 0;
    let cumReceived = 0;
    let cumPaid = 0;
    return monthlyData.map(m => {
      cumIncome += m.income;
      cumExpense += m.expense;
      cumReceived += m.received;
      cumPaid += m.paid;
      return {
        ...m,
        cumIncome,
        cumExpense,
        cumReceived,
        cumPaid,
        expectedBalance: cumIncome - cumExpense,
        actualBalance: cumReceived - cumPaid,
      };
    });
  }, [monthlyData]);

  // Current month key
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleAddTerm = () => {
    addPaymentTerm(project.id, {
      milestone: '',
      percentage: 0,
      amountUSD: 0,
      expectedDate: '',
      description: '',
    });
    setExpandedSection('terms');
  };

  const handleAddInvoice = () => {
    addCashFlowInvoice(project.id, {
      paymentTermId: paymentTerms.length > 0 ? paymentTerms[0].id : '',
      invoiceNo: '',
      invoiceDate: '',
      amountUSD: 0,
      receivedDate: '',
      receivedAmount: 0,
      notes: '',
    });
    setExpandedSection('invoices');
  };

  const handleAddExpense = () => {
    addCashFlowExpense(project.id, {
      description: '',
      category: 'material',
      amountUSD: 0,
      expectedDate: '',
      actualDate: '',
      paid: false,
      notes: '',
    });
    setExpandedSection('expenses');
  };

  const autoCalcTermAmounts = () => {
    if (!contractUSD || totalTermsPct === 0) return;
    paymentTerms.forEach(term => {
      if (term.percentage > 0) {
        const calcAmount = Math.round(contractUSD * term.percentage / 100);
        updatePaymentTerm(project.id, term.id, { amountUSD: calcAmount });
      }
    });
  };

  // Max bar value for chart
  const maxBarValue = useMemo(() => {
    if (cumulativeData.length === 0) return 1;
    return Math.max(
      ...cumulativeData.map(d => Math.max(Math.abs(d.cumIncome), Math.abs(d.cumExpense), Math.abs(d.cumReceived), Math.abs(d.cumPaid), Math.abs(d.expectedBalance), Math.abs(d.actualBalance))),
      1
    );
  }, [cumulativeData]);

  return (
    <div className="cashflow-tab">
      {/* Summary Dashboard */}
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
          <div className="cf-dash-label">총 지출 (예정)</div>
          <div className="cf-dash-value">{fmtUSD(totalExpensesUSD)}</div>
          <div className="cf-dash-sub">집행 {fmtUSD(totalPaidUSD)}</div>
        </div>
        <div className="cf-dash-card cf-dash-balance">
          <div className="cf-dash-label">현재 잔액</div>
          <div className="cf-dash-value" style={{ color: totalReceivedUSD - totalPaidUSD >= 0 ? '#10b981' : '#ef4444' }}>
            {fmtUSD(totalReceivedUSD - totalPaidUSD)}
          </div>
          <div className="cf-dash-sub">수금 - 집행</div>
        </div>
      </div>

      {/* Payment Terms Section */}
      <div className="cf-section">
        <div className="cf-section-header" onClick={() => setExpandedSection(expandedSection === 'terms' ? null : 'terms')}>
          <h3>{expandedSection === 'terms' ? '▾' : '▸'} Payment Terms ({paymentTerms.length}건)</h3>
          <div className="cf-section-actions" onClick={e => e.stopPropagation()}>
            {paymentTerms.length > 0 && totalTermsPct > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={autoCalcTermAmounts} title="비율에 따라 금액 자동 계산">
                금액 자동 계산
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={handleAddTerm}>+ 추가</button>
          </div>
        </div>
        {expandedSection === 'terms' && (
          <div className="cf-section-body">
            {paymentTerms.length > 0 ? (
              <table className="data-table cf-table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th style={{ width: 80 }}>비율 (%)</th>
                    <th style={{ width: 120 }}>금액 (USD)</th>
                    <th style={{ width: 130 }}>예상 수금일</th>
                    <th>비고</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.map(term => (
                    <tr key={term.id}>
                      <td className="td-white">
                        <EditableCell value={term.milestone} onSave={v => updatePaymentTerm(project.id, term.id, { milestone: v })} placeholder="예: 계약금 (Advance)" />
                      </td>
                      <td className="td-white">
                        <EditableCell value={String(term.percentage)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { percentage: Number(v) })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={String(term.amountUSD)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { amountUSD: Number(v) })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={term.expectedDate} type="date" onSave={v => updatePaymentTerm(project.id, term.id, { expectedDate: v })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={term.description} onSave={v => updatePaymentTerm(project.id, term.id, { description: v })} placeholder="-" />
                      </td>
                      <td>
                        <button className="btn-icon btn-danger" onClick={() => deletePaymentTerm(project.id, term.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="cf-total-row">
                    <td><strong>합계</strong></td>
                    <td><strong>{totalTermsPct}%</strong></td>
                    <td><strong>{fmtUSD(totalTermsUSD)}</strong></td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="empty-message">등록된 Payment Terms가 없습니다. 계약 조건에 따른 수금 일정을 추가하세요.</p>
            )}
          </div>
        )}
      </div>

      {/* Invoices Section */}
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
                <thead>
                  <tr>
                    <th>Payment Term</th>
                    <th>Invoice No.</th>
                    <th style={{ width: 120 }}>Invoice 발행일</th>
                    <th style={{ width: 120 }}>청구 금액 (USD)</th>
                    <th style={{ width: 120 }}>수금일</th>
                    <th style={{ width: 120 }}>수금 금액 (USD)</th>
                    <th>비고</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className={inv.receivedDate ? 'cf-received' : ''}>
                      <td className="td-white">
                        <EditableCell
                          value={inv.paymentTermId}
                          type="select"
                          options={paymentTerms.map(t => ({ value: t.id, label: `${t.milestone} (${t.percentage}%)` }))}
                          onSave={v => updateCashFlowInvoice(project.id, inv.id, { paymentTermId: v })}
                        />
                      </td>
                      <td className="td-white">
                        <EditableCell value={inv.invoiceNo} onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceNo: v })} placeholder="INV-001" />
                      </td>
                      <td className="td-white">
                        <EditableCell value={inv.invoiceDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceDate: v })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={String(inv.amountUSD)} type="number" onSave={v => updateCashFlowInvoice(project.id, inv.id, { amountUSD: Number(v) })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={inv.receivedDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedDate: v })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={String(inv.receivedAmount)} type="number" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedAmount: Number(v) })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={inv.notes} onSave={v => updateCashFlowInvoice(project.id, inv.id, { notes: v })} placeholder="-" />
                      </td>
                      <td>
                        <button className="btn-icon btn-danger" onClick={() => deleteCashFlowInvoice(project.id, inv.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="cf-total-row">
                    <td colSpan={3}><strong>합계</strong></td>
                    <td><strong>{fmtUSD(totalInvoicedUSD)}</strong></td>
                    <td></td>
                    <td><strong>{fmtUSD(totalReceivedUSD)}</strong></td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="empty-message">등록된 Invoice가 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Expenses Section */}
      <div className="cf-section">
        <div className="cf-section-header" onClick={() => setExpandedSection(expandedSection === 'expenses' ? null : 'expenses')}>
          <h3>{expandedSection === 'expenses' ? '▾' : '▸'} 지출 / Expenses ({expenses.length}건)</h3>
          <div className="cf-section-actions" onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm btn-primary" onClick={handleAddExpense}>+ 추가</button>
          </div>
        </div>
        {expandedSection === 'expenses' && (
          <div className="cf-section-body">
            {expenses.length > 0 ? (
              <table className="data-table cf-table">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th style={{ width: 100 }}>분류</th>
                    <th style={{ width: 120 }}>금액 (USD)</th>
                    <th style={{ width: 120 }}>예정일</th>
                    <th style={{ width: 120 }}>실 지급일</th>
                    <th style={{ width: 60 }}>집행</th>
                    <th>비고</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className={exp.paid ? 'cf-paid' : ''}>
                      <td className="td-white">
                        <EditableCell value={exp.description} onSave={v => updateCashFlowExpense(project.id, exp.id, { description: v })} placeholder="자재비 - Steel" />
                      </td>
                      <td className="td-white">
                        <EditableCell
                          value={exp.category}
                          type="select"
                          options={EXPENSE_CATEGORIES}
                          onSave={v => updateCashFlowExpense(project.id, exp.id, { category: v as CashFlowExpense['category'] })}
                        />
                      </td>
                      <td className="td-white">
                        <EditableCell value={String(exp.amountUSD)} type="number" onSave={v => updateCashFlowExpense(project.id, exp.id, { amountUSD: Number(v) })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={exp.expectedDate} type="date" onSave={v => updateCashFlowExpense(project.id, exp.id, { expectedDate: v })} />
                      </td>
                      <td className="td-white">
                        <EditableCell value={exp.actualDate} type="date" onSave={v => updateCashFlowExpense(project.id, exp.id, { actualDate: v })} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={exp.paid}
                          onChange={e => updateCashFlowExpense(project.id, exp.id, { paid: e.target.checked })}
                        />
                      </td>
                      <td className="td-white">
                        <EditableCell value={exp.notes} onSave={v => updateCashFlowExpense(project.id, exp.id, { notes: v })} placeholder="-" />
                      </td>
                      <td>
                        <button className="btn-icon btn-danger" onClick={() => deleteCashFlowExpense(project.id, exp.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="cf-total-row">
                    <td colSpan={2}><strong>합계</strong></td>
                    <td><strong>{fmtUSD(totalExpensesUSD)}</strong></td>
                    <td colSpan={2}></td>
                    <td style={{ textAlign: 'center' }}><strong>{fmtUSD(totalPaidUSD)}</strong></td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="empty-message">등록된 지출 항목이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Monthly Cash Flow Table */}
      {cumulativeData.length > 0 && (
        <div className="cf-section">
          <div className="cf-section-header">
            <h3>Monthly Cash Flow</h3>
          </div>
          <div className="cf-section-body">
            <div className="cf-monthly-scroll">
              <table className="data-table cf-monthly-table">
                <thead>
                  <tr>
                    <th className="cf-month-col">월</th>
                    {cumulativeData.map(d => (
                      <th key={d.month} className={`cf-month-th ${d.month === currentMonthKey ? 'cf-current-month' : ''}`}>
                        {d.month.substring(2).replace('-', '.')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="cf-row-income">
                    <td className="cf-row-label">예상 수금</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.income > 0 ? fmtUSD(d.income) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-received">
                    <td className="cf-row-label">실 수금</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.received > 0 ? fmtUSD(d.received) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-expense">
                    <td className="cf-row-label">지출 예정</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.expense > 0 ? fmtUSD(d.expense) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-paid">
                    <td className="cf-row-label">실 지출</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.paid > 0 ? fmtUSD(d.paid) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-divider"><td colSpan={cumulativeData.length + 1}></td></tr>
                  <tr className="cf-row-cum-income">
                    <td className="cf-row-label">누적 수금(예상)</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.cumIncome > 0 ? fmtUSD(d.cumIncome) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-cum-received">
                    <td className="cf-row-label">누적 수금(실)</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.cumReceived > 0 ? fmtUSD(d.cumReceived) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-cum-expense">
                    <td className="cf-row-label">누적 지출</td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''}>
                        {d.cumExpense > 0 ? fmtUSD(d.cumExpense) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-balance">
                    <td className="cf-row-label"><strong>예상 잔액</strong></td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''} style={{ color: d.expectedBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {fmtUSD(d.expectedBalance)}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-actual-balance">
                    <td className="cf-row-label"><strong>실 잔액</strong></td>
                    {cumulativeData.map(d => (
                      <td key={d.month} className={d.month === currentMonthKey ? 'cf-current-month' : ''} style={{ color: d.actualBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {d.cumReceived > 0 || d.cumPaid > 0 ? fmtUSD(d.actualBalance) : '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Simple bar chart */}
            <div className="cf-chart">
              <div className="cf-chart-title">Cash Flow Chart (누적)</div>
              <div className="cf-chart-bars">
                {cumulativeData.map(d => (
                  <div key={d.month} className={`cf-chart-col ${d.month === currentMonthKey ? 'cf-chart-current' : ''}`}>
                    <div className="cf-chart-bar-group">
                      <div
                        className="cf-chart-bar cf-bar-income"
                        style={{ height: `${Math.max((d.cumIncome / maxBarValue) * 120, 2)}px` }}
                        title={`누적 수금(예상): ${fmtUSD(d.cumIncome)}`}
                      />
                      <div
                        className="cf-chart-bar cf-bar-received"
                        style={{ height: `${Math.max((d.cumReceived / maxBarValue) * 120, 0)}px` }}
                        title={`누적 수금(실): ${fmtUSD(d.cumReceived)}`}
                      />
                      <div
                        className="cf-chart-bar cf-bar-expense"
                        style={{ height: `${Math.max((d.cumExpense / maxBarValue) * 120, 2)}px` }}
                        title={`누적 지출: ${fmtUSD(d.cumExpense)}`}
                      />
                    </div>
                    <div className="cf-chart-label">{d.month.substring(5)}</div>
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
