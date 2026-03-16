import { useMemo } from 'react';
import type { Project } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface CashFlowTabProps {
  project: Project;
}

function fmtUSD(n: number): string {
  if (n === 0) return '-';
  return '$' + Math.round(n).toLocaleString();
}

function fmtCurrency(n: number, currency: string): string {
  if (n === 0) return '-';
  const prefix = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₩';
  return prefix + Math.round(n).toLocaleString();
}

// Safe formula evaluator: supports +, -, *, /, (, ), numbers, spaces
function evalFormula(formula: string): number {
  if (!formula || !formula.trim()) return 0;
  // If it's just a plain number
  const plain = Number(formula);
  if (!isNaN(plain)) return plain;
  // Only allow safe characters
  if (!/^[\d\s+\-*/().,%]+$/.test(formula)) return 0;
  try {
    // Replace % with /100
    const sanitized = formula.replace(/%/g, '/100');
    // eslint-disable-next-line no-eval
    const result = Function('"use strict"; return (' + sanitized + ')')();
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function toUSD(amount: number, currency: string, exchangeRate: number, eurRate: number): number {
  if (currency === 'USD') return amount;
  if (currency === 'EUR') return amount * (eurRate / exchangeRate);
  return amount / exchangeRate;
}

export default function CashFlowTab({ project }: CashFlowTabProps) {
  const {
    addPaymentTerm, updatePaymentTerm, deletePaymentTerm,
    addCashFlowInvoice, updateCashFlowInvoice, deleteCashFlowInvoice,
  } = useProjects();

  const paymentTerms = project.paymentTerms || [];
  const invoices = project.cashFlowInvoices || [];
  const exchangeRate = project.exchangeRate || 1350;
  const eurRate = project.eurExchangeRate || 1500;

  const contractUSD = project.updatedContractAmountUSD || project.initialContractAmountUSD ||
    (project.updatedContractAmount || project.initialContractAmount || 0) / exchangeRate;

  // Gather all purchase payment terms
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
          let epd = pt.expectedPaymentDate;
          if (!epd && pt.expectedInvoiceDate && pt.paymentDueDays > 0) {
            const d = new Date(pt.expectedInvoiceDate);
            d.setDate(d.getDate() + pt.paymentDueDays);
            epd = d.toISOString().split('T')[0];
          }
          result.push({
            purchaseId: purchase.id, itemName: item.name, partName: purchase.partName,
            supplier: purchase.supplier, orderAmount: purchase.orderAmount || 0,
            currency: purchase.currency || 'KRW', termLabel: pt.label, percentage: pt.percentage,
            amount: amt, amountUSD: toUSD(amt, purchase.currency || 'KRW', exchangeRate, eurRate),
            expectedPaymentDate: epd, actualPaymentDate: pt.actualPaymentDate, paid: pt.paid,
          });
        }
      }
    }
    return result;
  }, [project.items, exchangeRate, eurRate]);

  // Summary
  const totalTermsPct = paymentTerms.reduce((s, t) => s + (t.percentage || 0), 0);
  const totalTermsUSD = paymentTerms.reduce((s, t) => s + (t.amountUSD || 0), 0);
  const totalInvoicedUSD = invoices.reduce((s, inv) => s + (inv.amountUSD || 0), 0);
  const totalReceivedUSD = invoices.reduce((s, inv) => s + (inv.receivedAmount || 0), 0);
  const totalExpenseUSD = purchaseExpenses.reduce((s, e) => s + e.amountUSD, 0);
  const totalPaidUSD = purchaseExpenses.filter(e => e.paid).reduce((s, e) => s + e.amountUSD, 0);

  // Monthly cash flow: contract start + 24 months
  const monthlyData = useMemo(() => {
    const allDates: string[] = [];
    invoices.forEach(inv => {
      if (inv.expectedDate) allDates.push(inv.expectedDate);
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
    const months: { key: string; expectedIncome: number; actualIncome: number; expectedExpense: number; actualExpense: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        expectedIncome: 0, actualIncome: 0, expectedExpense: 0, actualExpense: 0,
      });
    }

    // Income from invoices (expected date → expectedIncome, received date → actualIncome)
    invoices.forEach(inv => {
      if (inv.expectedDate && inv.amountUSD) {
        const key = inv.expectedDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.expectedIncome += inv.amountUSD;
      }
      if (inv.receivedDate && inv.receivedAmount) {
        const key = inv.receivedDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.actualIncome += inv.receivedAmount;
      }
    });

    // Expenses from purchase payment terms
    purchaseExpenses.forEach(e => {
      if (e.expectedPaymentDate) {
        const key = e.expectedPaymentDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.expectedExpense += e.amountUSD;
      }
      if (e.paid && e.actualPaymentDate) {
        const key = e.actualPaymentDate.substring(0, 7);
        const m = months.find(x => x.key === key);
        if (m) m.actualExpense += e.amountUSD;
      }
    });

    return months;
  }, [invoices, purchaseExpenses, project.contractDate]);

  // Cumulative
  const cumulativeData = useMemo(() => {
    let cumExpInc = 0, cumActInc = 0, cumExpExp = 0, cumActExp = 0;
    return monthlyData.map(m => {
      cumExpInc += m.expectedIncome;
      cumActInc += m.actualIncome;
      cumExpExp += m.expectedExpense;
      cumActExp += m.actualExpense;
      return {
        ...m, cumExpInc, cumActInc, cumExpExp, cumActExp,
        // 예상 잔액: (실수금 + 예상수금) - 예상지출 → 실제 받은 돈 + 앞으로 받을 돈 - 앞으로 나갈 돈
        expectedBalance: (cumActInc + cumExpInc) - cumExpExp,
        // 실 잔액: 실수금 - 실지출
        actualBalance: cumActInc - cumActExp,
      };
    });
  }, [monthlyData]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleAddTerm = () => {
    addPaymentTerm(project.id, { milestone: '', percentage: 0, amountUSD: 0, expectedDate: '', description: '' });
  };

  const handleAddInvoice = () => {
    addCashFlowInvoice(project.id, {
      paymentTermId: paymentTerms.length > 0 ? paymentTerms[0].id : '',
      invoiceNo: '', invoiceDate: '', amountFormula: '', amountUSD: 0,
      expectedDate: '', receivedDate: '', receivedAmount: 0, notes: '',
    });
  };

  const autoCalcTermAmounts = () => {
    if (!contractUSD || totalTermsPct === 0) return;
    paymentTerms.forEach(term => {
      if (term.percentage > 0) updatePaymentTerm(project.id, term.id, { amountUSD: Math.round(contractUSD * term.percentage / 100) });
    });
  };

  return (
    <div className="cashflow-tab">
      {/* === Summary Dashboard === */}
      <div className="cf-dashboard">
        <div className="cf-dash-card cf-dash-contract">
          <div className="cf-dash-label">계약 금액</div>
          <div className="cf-dash-value">{fmtUSD(contractUSD)}</div>
        </div>
        <div className="cf-dash-card cf-dash-income">
          <div className="cf-dash-label">예상 수금</div>
          <div className="cf-dash-value">{fmtUSD(totalInvoicedUSD)}</div>
          <div className="cf-dash-sub">{invoices.length}건</div>
        </div>
        <div className="cf-dash-card cf-dash-received">
          <div className="cf-dash-label">실 수금</div>
          <div className="cf-dash-value">{fmtUSD(totalReceivedUSD)}</div>
        </div>
        <div className="cf-dash-card cf-dash-expense">
          <div className="cf-dash-label">예상 지출</div>
          <div className="cf-dash-value">{fmtUSD(totalExpenseUSD)}</div>
          <div className="cf-dash-sub">{purchaseExpenses.length}건</div>
        </div>
        <div className="cf-dash-card cf-dash-balance">
          <div className="cf-dash-label">잔액 (실 수금 - 실 지출)</div>
          <div className="cf-dash-value" style={{ color: totalReceivedUSD - totalPaidUSD >= 0 ? '#10b981' : '#ef4444' }}>
            {fmtUSD(totalReceivedUSD - totalPaidUSD)}
          </div>
        </div>
      </div>

      {/* === 1. Payment Terms (계약 조건) === */}
      <div className="cf-section">
        <div className="cf-section-header">
          <h3>Payment Terms (계약 조건)</h3>
          <div className="cf-section-actions">
            {paymentTerms.length > 0 && totalTermsPct > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={autoCalcTermAmounts}>금액 자동 계산</button>
            )}
            <button className="btn btn-sm btn-primary" onClick={handleAddTerm}>+ 추가</button>
          </div>
        </div>
        <div className="cf-section-body">
          {paymentTerms.length > 0 ? (
            <table className="data-table cf-table">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th style={{width:80}}>비율(%)</th>
                  <th style={{width:120}}>금액(USD)</th>
                  <th style={{width:140}}>예상일</th>
                  <th>비고</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {paymentTerms.map(term => (
                  <tr key={term.id}>
                    <td className="td-white"><EditableCell value={term.milestone} onSave={v => updatePaymentTerm(project.id, term.id, { milestone: v })} placeholder="예: Advance" /></td>
                    <td className="td-white"><EditableCell value={String(term.percentage)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { percentage: Number(v) })} /></td>
                    <td className="td-white"><EditableCell value={String(term.amountUSD)} type="number" onSave={v => updatePaymentTerm(project.id, term.id, { amountUSD: Number(v) })} /></td>
                    <td className="td-white"><EditableCell value={term.expectedDate} type="date" onSave={v => updatePaymentTerm(project.id, term.id, { expectedDate: v })} /></td>
                    <td className="td-white"><EditableCell value={term.description} onSave={v => updatePaymentTerm(project.id, term.id, { description: v })} placeholder="-" /></td>
                    <td><button className="btn-icon btn-danger" onClick={() => deletePaymentTerm(project.id, term.id)}>✕</button></td>
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
          ) : <p className="empty-message">계약 조건에 따른 Payment Terms를 추가하세요.</p>}
        </div>
      </div>

      {/* === 2. Invoice / 수금 === */}
      <div className="cf-section">
        <div className="cf-section-header">
          <h3>Invoice / 수금 ({invoices.length}건)</h3>
          <div className="cf-section-actions">
            <button className="btn btn-sm btn-primary" onClick={handleAddInvoice}>+ 추가</button>
          </div>
        </div>
        <div className="cf-section-body">
          {invoices.length > 0 ? (
            <table className="data-table cf-table">
              <thead>
                <tr>
                  <th>Payment Term</th>
                  <th>Invoice No.</th>
                  <th style={{width:110}}>발행일</th>
                  <th style={{width:180}}>금액 수식</th>
                  <th style={{width:110}}>금액(USD)</th>
                  <th style={{width:110}}>예상 수금일</th>
                  <th style={{width:110}}>실 수금일</th>
                  <th style={{width:110}}>수금액(USD)</th>
                  <th>비고</th>
                  <th style={{width:36}}></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className={inv.receivedDate ? 'cf-received' : ''}>
                    <td className="td-white">
                      <EditableCell value={inv.paymentTermId} type="select"
                        options={paymentTerms.map(t => ({ value: t.id, label: `${t.milestone} (${t.percentage}%)` }))}
                        onSave={v => updateCashFlowInvoice(project.id, inv.id, { paymentTermId: v })} />
                    </td>
                    <td className="td-white"><EditableCell value={inv.invoiceNo} onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceNo: v })} placeholder="INV-001" /></td>
                    <td className="td-white"><EditableCell value={inv.invoiceDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { invoiceDate: v })} /></td>
                    <td className="td-white">
                      <EditableCell
                        value={inv.amountFormula || String(inv.amountUSD || '')}
                        onSave={v => {
                          const computed = evalFormula(v);
                          updateCashFlowInvoice(project.id, inv.id, { amountFormula: v, amountUSD: Math.round(computed) });
                        }}
                        placeholder="예: 500000 * 0.3"
                      />
                      {inv.amountFormula && inv.amountFormula !== String(inv.amountUSD) && (
                        <div className="cf-formula-hint">= {fmtUSD(inv.amountUSD)}</div>
                      )}
                    </td>
                    <td className="td-cost">{fmtUSD(inv.amountUSD)}</td>
                    <td className="td-white"><EditableCell value={inv.expectedDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { expectedDate: v })} /></td>
                    <td className="td-white"><EditableCell value={inv.receivedDate} type="date" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedDate: v })} /></td>
                    <td className="td-white"><EditableCell value={String(inv.receivedAmount)} type="number" onSave={v => updateCashFlowInvoice(project.id, inv.id, { receivedAmount: Number(v) })} /></td>
                    <td className="td-white"><EditableCell value={inv.notes} onSave={v => updateCashFlowInvoice(project.id, inv.id, { notes: v })} placeholder="-" /></td>
                    <td><button className="btn-icon btn-danger" onClick={() => deleteCashFlowInvoice(project.id, inv.id)}>✕</button></td>
                  </tr>
                ))}
                <tr className="cf-total-row">
                  <td colSpan={4}><strong>합계</strong></td>
                  <td><strong>{fmtUSD(totalInvoicedUSD)}</strong></td>
                  <td colSpan={2}></td>
                  <td><strong>{fmtUSD(totalReceivedUSD)}</strong></td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          ) : <p className="empty-message">Invoice를 추가하여 수금 일정을 관리하세요.</p>}
        </div>
      </div>

      {/* === 3. 지출 (구매 관리 연동) === */}
      <div className="cf-section">
        <div className="cf-section-header">
          <h3>지출 / Expenses - 구매 관리 연동 ({purchaseExpenses.length}건)</h3>
        </div>
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
      </div>

      {/* === 4. Monthly Cash Flow === */}
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
                    <th className="cf-month-label-col" rowSpan={2}>구분</th>
                    {cumulativeData.map(d => (
                      <th key={d.key} className={`cf-month-th ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>
                        {d.key.substring(2).replace('-', '.')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 수금 (Income) */}
                  <tr className="cf-row-section-header"><td colSpan={cumulativeData.length + 1}>수금 (Income)</td></tr>
                  <tr className="cf-row-expected-income">
                    <td className="cf-row-label">예상 수금</td>
                    {cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.expectedIncome > 0 ? fmtUSD(d.expectedIncome) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-actual-income">
                    <td className="cf-row-label">실 수금</td>
                    {cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.actualIncome > 0 ? fmtUSD(d.actualIncome) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-cum">
                    <td className="cf-row-label">누적 예상</td>
                    {cumulativeData.map(d => <td key={d.key} className={`cf-cum-cell ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>{d.cumExpInc > 0 ? fmtUSD(d.cumExpInc) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-cum">
                    <td className="cf-row-label">누적 실수금</td>
                    {cumulativeData.map(d => <td key={d.key} className={`cf-cum-cell ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>{d.cumActInc > 0 ? fmtUSD(d.cumActInc) : '-'}</td>)}
                  </tr>

                  {/* 지출 (Expense) */}
                  <tr className="cf-row-section-header"><td colSpan={cumulativeData.length + 1}>지출 (Expense)</td></tr>
                  <tr className="cf-row-expected-expense">
                    <td className="cf-row-label">예상 지출</td>
                    {cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.expectedExpense > 0 ? fmtUSD(d.expectedExpense) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-actual-expense">
                    <td className="cf-row-label">실 지출</td>
                    {cumulativeData.map(d => <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}>{d.actualExpense > 0 ? fmtUSD(d.actualExpense) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-cum">
                    <td className="cf-row-label">누적 예상</td>
                    {cumulativeData.map(d => <td key={d.key} className={`cf-cum-cell ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>{d.cumExpExp > 0 ? fmtUSD(d.cumExpExp) : '-'}</td>)}
                  </tr>
                  <tr className="cf-row-cum">
                    <td className="cf-row-label">누적 실지출</td>
                    {cumulativeData.map(d => <td key={d.key} className={`cf-cum-cell ${d.key === currentMonthKey ? 'cf-current-month' : ''}`}>{d.cumActExp > 0 ? fmtUSD(d.cumActExp) : '-'}</td>)}
                  </tr>

                  {/* 잔액 (Balance) */}
                  <tr className="cf-row-section-header"><td colSpan={cumulativeData.length + 1}>잔액 (Balance)</td></tr>
                  <tr className="cf-row-balance">
                    <td className="cf-row-label"><strong>예상 잔액</strong></td>
                    {cumulativeData.map(d => (
                      <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}
                        style={{color: d.expectedBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 600}}>
                        {d.cumExpInc > 0 || d.cumExpExp > 0 ? fmtUSD(d.expectedBalance) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="cf-row-actual-balance">
                    <td className="cf-row-label"><strong>실 잔액</strong></td>
                    {cumulativeData.map(d => (
                      <td key={d.key} className={d.key === currentMonthKey ? 'cf-current-month' : ''}
                        style={{color: d.actualBalance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700}}>
                        {d.cumActInc > 0 || d.cumActExp > 0 ? fmtUSD(d.actualBalance) : '-'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
