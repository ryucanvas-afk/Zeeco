import { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Project } from '../types';

interface CashFlowPdfPreviewProps {
  project: Project;
  onClose: () => void;
}

function fmtUSD(n: number): string {
  if (n === 0) return '-';
  return '$' + Math.round(n).toLocaleString();
}

function fmtUSDCompact(n: number): string {
  if (n === 0) return '-';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

function toUSD(amount: number, currency: string, exchangeRate: number, eurRate: number): number {
  if (currency === 'USD') return amount;
  if (currency === 'EUR') return amount * (eurRate / exchangeRate);
  return amount / exchangeRate;
}

export default function CashFlowPdfPreview({ project, onClose }: CashFlowPdfPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exchangeRate = project.exchangeRate || 1350;
  const eurRate = project.eurExchangeRate || 1500;
  const contractUSD = project.updatedContractAmountUSD || project.initialContractAmountUSD ||
    (project.updatedContractAmount || project.initialContractAmount || 0) / exchangeRate;

  const paymentTerms = project.paymentTerms || [];
  const invoices = project.cashFlowInvoices || [];

  const totalTermsUSD = paymentTerms.reduce((s, t) => s + (t.amountUSD || 0), 0);
  const totalInvoicedUSD = invoices.reduce((s, inv) => s + (inv.amountUSD || 0), 0);
  const totalReceivedUSD = invoices.reduce((s, inv) => s + (inv.receivedAmount || 0), 0);

  // Gather purchase expenses
  const purchaseExpenses = useMemo(() => {
    const result: {
      itemName: string; partName: string; supplier: string;
      termLabel: string; percentage: number; amountUSD: number;
      expectedPaymentDate: string; actualPaymentDate: string; paid: boolean;
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
            itemName: item.name, partName: purchase.partName, supplier: purchase.supplier,
            termLabel: pt.label, percentage: pt.percentage,
            amountUSD: toUSD(amt, purchase.currency || 'KRW', exchangeRate, eurRate),
            expectedPaymentDate: epd, actualPaymentDate: pt.actualPaymentDate, paid: pt.paid,
          });
        }
      }
    }
    return result;
  }, [project.items, exchangeRate, eurRate]);

  const totalExpenseUSD = purchaseExpenses.reduce((s, e) => s + e.amountUSD, 0);
  const totalPaidUSD = purchaseExpenses.filter(e => e.paid).reduce((s, e) => s + e.amountUSD, 0);

  // Monthly data - ALL months shown
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
    paymentTerms.forEach(t => { if (t.expectedDate) allDates.push(t.expectedDate); });
    if (allDates.length === 0) return [];

    allDates.sort();
    const startDate = new Date(allDates[0]);
    const months: { key: string; label: string; expectedIncome: number; actualIncome: number; expectedExpense: number; actualExpense: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        expectedIncome: 0, actualIncome: 0, expectedExpense: 0, actualExpense: 0,
      });
    }

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
  }, [invoices, purchaseExpenses, project.contractDate, paymentTerms]);

  // Cumulative
  const cumulativeData = useMemo(() => {
    let cumInc = 0, cumExp = 0;
    return monthlyData.map(m => {
      cumInc += m.expectedIncome + m.actualIncome;
      cumExp += m.expectedExpense + m.actualExpense;
      return { ...m, cumInc, cumExp, balance: cumInc - cumExp };
    });
  }, [monthlyData]);

  // Group expenses by supplier for summary
  const expenseBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    purchaseExpenses.forEach(e => {
      const key = e.supplier || e.partName || 'Other';
      map.set(key, (map.get(key) || 0) + e.amountUSD);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [purchaseExpenses]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleExport = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const imgRatio = canvas.width / canvas.height;
      const pageRatio = usableW / usableH;
      let drawW: number, drawH: number;
      if (imgRatio > pageRatio) {
        drawW = usableW;
        drawH = usableW / imgRatio;
      } else {
        drawH = usableH;
        drawW = usableH * imgRatio;
      }
      const offsetX = margin + (usableW - drawW) / 2;
      const offsetY = margin + (usableH - drawH) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
      pdf.save(`${project.name || 'Project'}_CashFlow_Report.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  // Find max value for chart scaling
  const maxVal = useMemo(() => {
    let max = 0;
    cumulativeData.forEach(d => {
      max = Math.max(max, Math.abs(d.cumInc), Math.abs(d.cumExp), Math.abs(d.balance));
    });
    return max || 1;
  }, [cumulativeData]);

  return (
    <div className="cf-pdf-overlay">
      <div className="cf-pdf-container">
        <div className="cf-pdf-toolbar">
          <h3>Cash Flow Report - PDF Preview</h3>
          <div className="cf-pdf-toolbar-actions">
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'PDF Download'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="cf-pdf-scroll">
          {/* === PDF Content (A4 Landscape) === */}
          <div ref={printRef} className="cf-pdf-page">
            {/* Header */}
            <div className="cf-pdf-header">
              <div className="cf-pdf-header-left">
                <div className="cf-pdf-title">{project.name || 'Project'}</div>
                <div className="cf-pdf-subtitle">Cash Flow Report</div>
              </div>
              <div className="cf-pdf-header-right">
                <div className="cf-pdf-meta">Project No. {project.projectNo || '-'}</div>
                <div className="cf-pdf-meta">Client: {project.client || '-'}</div>
                <div className="cf-pdf-meta">Date: {now.toISOString().split('T')[0]}</div>
              </div>
            </div>

            {/* KPI Dashboard */}
            <div className="cf-pdf-kpi-row">
              <div className="cf-pdf-kpi cf-pdf-kpi-contract">
                <div className="cf-pdf-kpi-label">Contract Amount</div>
                <div className="cf-pdf-kpi-value">{fmtUSD(contractUSD)}</div>
              </div>
              <div className="cf-pdf-kpi-arrow">→</div>
              <div className="cf-pdf-kpi cf-pdf-kpi-terms">
                <div className="cf-pdf-kpi-label">Payment Terms</div>
                <div className="cf-pdf-kpi-value">{fmtUSD(totalTermsUSD)}</div>
                <div className="cf-pdf-kpi-sub">{paymentTerms.length}건</div>
              </div>
              <div className="cf-pdf-kpi-arrow">→</div>
              <div className="cf-pdf-kpi cf-pdf-kpi-invoice">
                <div className="cf-pdf-kpi-label">Invoiced</div>
                <div className="cf-pdf-kpi-value">{fmtUSD(totalInvoicedUSD)}</div>
                <div className="cf-pdf-kpi-sub">{invoices.length}건</div>
              </div>
              <div className="cf-pdf-kpi-arrow">→</div>
              <div className="cf-pdf-kpi cf-pdf-kpi-received">
                <div className="cf-pdf-kpi-label">Received</div>
                <div className="cf-pdf-kpi-value">{fmtUSD(totalReceivedUSD)}</div>
              </div>
              <div className="cf-pdf-kpi-divider"></div>
              <div className="cf-pdf-kpi cf-pdf-kpi-expense">
                <div className="cf-pdf-kpi-label">Total Expense</div>
                <div className="cf-pdf-kpi-value">{fmtUSD(totalExpenseUSD)}</div>
                <div className="cf-pdf-kpi-sub">Paid: {fmtUSD(totalPaidUSD)}</div>
              </div>
              <div className="cf-pdf-kpi-arrow">=</div>
              <div className="cf-pdf-kpi cf-pdf-kpi-balance">
                <div className="cf-pdf-kpi-label">Net Balance</div>
                <div className="cf-pdf-kpi-value" style={{ color: (totalReceivedUSD - totalPaidUSD) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtUSD(totalReceivedUSD - totalPaidUSD)}
                </div>
              </div>
            </div>

            {/* Main content: 2 columns */}
            <div className="cf-pdf-body">
              {/* Left: Payment Terms + Invoice */}
              <div className="cf-pdf-left">
                {/* Payment Terms */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-income">Payment Terms (계약 조건)</div>
                  {paymentTerms.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr>
                          <th>Milestone</th>
                          <th>%</th>
                          <th>Amount (USD)</th>
                          <th>Expected Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentTerms.map(t => (
                          <tr key={t.id}>
                            <td>{t.milestone || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{t.percentage}%</td>
                            <td style={{ textAlign: 'right' }}>{fmtUSD(t.amountUSD)}</td>
                            <td style={{ textAlign: 'center' }}>{t.expectedDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No payment terms</div>}
                </div>

                {/* Invoice Summary */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-received">Invoice / 수금</div>
                  {invoices.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Amount</th>
                          <th>Expected</th>
                          <th>Received</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map(inv => {
                          const term = paymentTerms.find(t => t.id === inv.paymentTermId);
                          return (
                            <tr key={inv.id} className={inv.receivedDate ? 'cf-pdf-row-done' : ''}>
                              <td>{term ? term.milestone : inv.invoiceNo || '-'}</td>
                              <td style={{ textAlign: 'right' }}>{fmtUSD(inv.amountUSD)}</td>
                              <td style={{ textAlign: 'center' }}>{inv.expectedDate || '-'}</td>
                              <td style={{ textAlign: 'right' }}>{inv.receivedAmount ? fmtUSD(inv.receivedAmount) : '-'}</td>
                              <td style={{ textAlign: 'center' }}>{inv.receivedDate ? 'Done' : 'Pending'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No invoices</div>}
                </div>

                {/* Expense by Supplier */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-expense">Expense Summary (구매 연동)</div>
                  {expenseBySupplier.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr>
                          <th>Supplier / Item</th>
                          <th>Amount (USD)</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseBySupplier.slice(0, 8).map(([name, amt], idx) => (
                          <tr key={idx}>
                            <td>{name}</td>
                            <td style={{ textAlign: 'right' }}>{fmtUSD(amt)}</td>
                            <td style={{ textAlign: 'center' }}>{totalExpenseUSD ? (amt / totalExpenseUSD * 100).toFixed(1) + '%' : '-'}</td>
                          </tr>
                        ))}
                        {expenseBySupplier.length > 8 && (
                          <tr>
                            <td>Others ({expenseBySupplier.length - 8})</td>
                            <td style={{ textAlign: 'right' }}>{fmtUSD(expenseBySupplier.slice(8).reduce((s, e) => s + e[1], 0))}</td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No expenses</div>}
                </div>
              </div>

              {/* Right: Monthly Cash Flow Chart + Table */}
              <div className="cf-pdf-right">
                {/* Visual Bar Chart */}
                {cumulativeData.length > 0 && (
                  <div className="cf-pdf-section cf-pdf-section-chart">
                    <div className="cf-pdf-section-title cf-pdf-st-chart">Monthly Cash Flow Trend (전 월 표시)</div>
                    <div className="cf-pdf-chart">
                      {cumulativeData.map(d => {
                        const incH = maxVal > 0 ? (d.cumInc / maxVal) * 100 : 0;
                        const expH = maxVal > 0 ? (d.cumExp / maxVal) * 100 : 0;
                        const isCurrent = d.key === currentMonthKey;
                        return (
                          <div key={d.key} className={`cf-pdf-chart-col ${isCurrent ? 'cf-pdf-chart-current' : ''}`}>
                            <div className="cf-pdf-chart-bars">
                              <div className="cf-pdf-chart-bar cf-pdf-bar-inc" style={{ height: `${incH}%` }}></div>
                              <div className="cf-pdf-chart-bar cf-pdf-bar-exp" style={{ height: `${expH}%` }}></div>
                            </div>
                            <div className="cf-pdf-chart-label">{d.label.slice(3)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="cf-pdf-chart-legend">
                      <span className="cf-pdf-legend-item"><span className="cf-pdf-legend-dot cf-pdf-dot-inc"></span>Cumulative Income</span>
                      <span className="cf-pdf-legend-item"><span className="cf-pdf-legend-dot cf-pdf-dot-exp"></span>Cumulative Expense</span>
                    </div>
                  </div>
                )}

                {/* Monthly Detail Table - ALL months */}
                {cumulativeData.length > 0 && (
                  <div className="cf-pdf-section cf-pdf-section-monthly">
                    <div className="cf-pdf-section-title cf-pdf-st-chart">Monthly Detail</div>
                    <div className="cf-pdf-monthly-scroll">
                      <table className="cf-pdf-table cf-pdf-monthly-table">
                        <thead>
                          <tr>
                            <th className="cf-pdf-sticky-col">Month</th>
                            {cumulativeData.map(d => (
                              <th key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}>
                                {d.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="cf-pdf-row-income">
                            <td className="cf-pdf-sticky-col">Income</td>
                            {cumulativeData.map(d => (
                              <td key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}>
                                {d.expectedIncome + d.actualIncome > 0 ? fmtUSDCompact(d.expectedIncome + d.actualIncome) : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="cf-pdf-row-expense">
                            <td className="cf-pdf-sticky-col">Expense</td>
                            {cumulativeData.map(d => (
                              <td key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}>
                                {d.expectedExpense + d.actualExpense > 0 ? fmtUSDCompact(d.expectedExpense + d.actualExpense) : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="cf-pdf-row-cum-inc">
                            <td className="cf-pdf-sticky-col">Cum. Income</td>
                            {cumulativeData.map(d => (
                              <td key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}>
                                {fmtUSDCompact(d.cumInc)}
                              </td>
                            ))}
                          </tr>
                          <tr className="cf-pdf-row-cum-exp">
                            <td className="cf-pdf-sticky-col">Cum. Expense</td>
                            {cumulativeData.map(d => (
                              <td key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}>
                                {fmtUSDCompact(d.cumExp)}
                              </td>
                            ))}
                          </tr>
                          <tr className="cf-pdf-row-balance">
                            <td className="cf-pdf-sticky-col">Balance</td>
                            {cumulativeData.map(d => (
                              <td key={d.key} className={d.key === currentMonthKey ? 'cf-pdf-current-col' : ''}
                                style={{ color: d.balance >= 0 ? '#10b981' : '#ef4444' }}>
                                {fmtUSDCompact(d.balance)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Flow Diagram - shows relationship */}
            <div className="cf-pdf-flow">
              <div className="cf-pdf-flow-box cf-pdf-flow-contract">
                <div className="cf-pdf-flow-label">Contract</div>
                <div className="cf-pdf-flow-value">{fmtUSDCompact(contractUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-terms">
                <div className="cf-pdf-flow-label">Payment Terms</div>
                <div className="cf-pdf-flow-value">{paymentTerms.length}건</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-inv">
                <div className="cf-pdf-flow-label">Invoice</div>
                <div className="cf-pdf-flow-value">{fmtUSDCompact(totalInvoicedUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-recv">
                <div className="cf-pdf-flow-label">Received</div>
                <div className="cf-pdf-flow-value">{fmtUSDCompact(totalReceivedUSD)}</div>
              </div>
              <div className="cf-pdf-flow-sep">|</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-purchase">
                <div className="cf-pdf-flow-label">Purchase</div>
                <div className="cf-pdf-flow-value">{purchaseExpenses.length}건</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-exp">
                <div className="cf-pdf-flow-label">Expense</div>
                <div className="cf-pdf-flow-value">{fmtUSDCompact(totalExpenseUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-paid">
                <div className="cf-pdf-flow-label">Paid</div>
                <div className="cf-pdf-flow-value">{fmtUSDCompact(totalPaidUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">=</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-net" style={{ borderColor: (totalReceivedUSD - totalPaidUSD) >= 0 ? '#10b981' : '#ef4444' }}>
                <div className="cf-pdf-flow-label">Net</div>
                <div className="cf-pdf-flow-value" style={{ color: (totalReceivedUSD - totalPaidUSD) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtUSDCompact(totalReceivedUSD - totalPaidUSD)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
