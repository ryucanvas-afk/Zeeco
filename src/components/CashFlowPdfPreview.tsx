import { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Project } from '../types';

interface CashFlowPdfPreviewProps {
  project: Project;
  onClose: () => void;
}

function fmtUSD(n: number): string {
  if (!n || n === 0) return '-';
  return '$' + Math.round(n).toLocaleString();
}

function toUSD(amount: number, currency: string, exchangeRate: number, eurRate: number): number {
  if (currency === 'USD') return amount;
  if (currency === 'EUR') return amount * (eurRate / exchangeRate);
  return amount / exchangeRate;
}

const PIE_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
  '#a855f7', '#06b6d4',
];

export default function CashFlowPdfPreview({ project, onClose }: CashFlowPdfPreviewProps) {
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
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

  // Gather purchase expenses with full detail
  const purchaseExpenses = useMemo(() => {
    const result: {
      itemName: string; partName: string; supplier: string;
      termLabel: string; percentage: number; amount: number; currency: string; amountUSD: number;
      expectedPaymentDate: string; actualPaymentDate: string; paid: boolean;
      purchaseId: string;
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
            amount: amt, currency: purchase.currency || 'KRW',
            amountUSD: toUSD(amt, purchase.currency || 'KRW', exchangeRate, eurRate),
            expectedPaymentDate: epd, actualPaymentDate: pt.actualPaymentDate, paid: pt.paid,
            purchaseId: purchase.id,
          });
        }
      }
    }
    return result;
  }, [project.items, exchangeRate, eurRate]);

  const totalExpenseUSD = purchaseExpenses.reduce((s, e) => s + e.amountUSD, 0);
  const totalPaidUSD = purchaseExpenses.filter(e => e.paid).reduce((s, e) => s + e.amountUSD, 0);

  // Group expenses by supplier for pie chart
  const expenseBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    purchaseExpenses.forEach(e => {
      const key = e.supplier || e.partName || 'Other';
      map.set(key, (map.get(key) || 0) + e.amountUSD);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [purchaseExpenses]);

  // Monthly data - ALL months from first to last date
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
    const endDate = new Date(allDates[allDates.length - 1]);
    const monthCount = Math.max(
      (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 2,
      12
    );
    const months: { key: string; label: string; expectedIncome: number; actualIncome: number; expectedExpense: number; actualExpense: number }[] = [];
    for (let i = 0; i < monthCount; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
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

  // Cumulative with expectedBalance matching CashFlowTab
  const cumulativeData = useMemo(() => {
    let cumExpInc = 0, cumActInc = 0, cumExpExp = 0;
    return monthlyData.map(m => {
      cumExpInc += m.expectedIncome;
      cumActInc += m.actualIncome;
      cumExpExp += m.expectedExpense;
      return {
        ...m, cumExpInc, cumActInc, cumExpExp,
        expectedBalance: (cumActInc + cumExpInc) - cumExpExp,
      };
    });
  }, [monthlyData]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // SVG Pie chart
  const pieSlices = useMemo(() => {
    if (totalExpenseUSD === 0 || expenseBySupplier.length === 0) return [];
    let cumAngle = -90;
    return expenseBySupplier.map(([name, amt], idx) => {
      const pct = amt / totalExpenseUSD;
      const angle = pct * 360;
      const startAngle = cumAngle;
      const endAngle = cumAngle + angle;
      cumAngle = endAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const r = 65;
      const cx = 75, cy = 75;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;
      const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
      return { path, color: PIE_COLORS[idx % PIE_COLORS.length], name, amt, pct };
    });
  }, [expenseBySupplier, totalExpenseUSD]);

  const handleExport = async () => {
    if (!page1Ref.current || !page2Ref.current) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 4;

      const addPageImage = async (el: HTMLDivElement) => {
        const canvas = await html2canvas(el, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const imgRatio = canvas.width / canvas.height;
        const pageRatio = usableW / usableH;
        let drawW: number, drawH: number;
        if (imgRatio > pageRatio) {
          drawW = usableW; drawH = usableW / imgRatio;
        } else {
          drawH = usableH; drawW = usableH * imgRatio;
        }
        const offsetX = margin + (usableW - drawW) / 2;
        const offsetY = margin + (usableH - drawH) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
      };

      await addPageImage(page1Ref.current);
      pdf.addPage('a4', 'landscape');
      await addPageImage(page2Ref.current);

      pdf.save(`${project.name || 'Project'}_CashFlow_Report.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  // Get monthly detail items (invoices & expenses per month)
  const getMonthItems = (monthKey: string) => {
    const incExpected = invoices.filter(inv => inv.expectedDate && inv.expectedDate.substring(0, 7) === monthKey && inv.amountUSD);
    const incReceived = invoices.filter(inv => inv.receivedDate && inv.receivedDate.substring(0, 7) === monthKey && inv.receivedAmount);
    const expExpected = purchaseExpenses.filter(e => e.expectedPaymentDate && e.expectedPaymentDate.substring(0, 7) === monthKey);
    const expPaid = purchaseExpenses.filter(e => e.paid && e.actualPaymentDate && e.actualPaymentDate.substring(0, 7) === monthKey);
    return { incExpected, incReceived, expExpected, expPaid };
  };

  return (
    <div className="cf-pdf-overlay">
      <div className="cf-pdf-container">
        <div className="cf-pdf-toolbar">
          <h3>Cash Flow Report - PDF Preview (2 Pages)</h3>
          <div className="cf-pdf-toolbar-actions">
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'PDF Download'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="cf-pdf-scroll">
          {/* ========== PAGE 1: Summary ========== */}
          <div ref={page1Ref} className="cf-pdf-page">
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
                <div className="cf-pdf-kpi-label">Contract</div>
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
                <div className="cf-pdf-kpi-label">Expense</div>
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

            {/* Body: 2 columns */}
            <div className="cf-pdf-body">
              {/* Left: Payment Terms + Invoice */}
              <div className="cf-pdf-left">
                {/* 1. Payment Terms */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-income">1. Payment Terms (계약 조건) - 계약금액: {fmtUSD(contractUSD)}</div>
                  {paymentTerms.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr><th>Milestone</th><th>%</th><th>Amount (USD)</th><th>Expected Date</th></tr>
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
                        <tr className="cf-pdf-total-row">
                          <td><strong>합계</strong></td>
                          <td style={{ textAlign: 'center' }}><strong>{paymentTerms.reduce((s, t) => s + (t.percentage || 0), 0)}%</strong></td>
                          <td style={{ textAlign: 'right' }}><strong>{fmtUSD(totalTermsUSD)}</strong></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No payment terms</div>}
                </div>

                {/* 2. Invoice / 수금 */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-received">2. Invoice / 수금 현황</div>
                  {invoices.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr><th>Invoice</th><th>Amount</th><th>Expected</th><th>Received</th><th>Status</th></tr>
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
                        <tr className="cf-pdf-total-row">
                          <td><strong>합계</strong></td>
                          <td style={{ textAlign: 'right' }}><strong>{fmtUSD(totalInvoicedUSD)}</strong></td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}><strong>{fmtUSD(totalReceivedUSD)}</strong></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No invoices</div>}
                </div>
              </div>

              {/* Right: Expense with Pie */}
              <div className="cf-pdf-right">
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-expense">3. Expense Summary (구매 연동) - 전체 계약 대비 {contractUSD > 0 ? (totalExpenseUSD / contractUSD * 100).toFixed(1) : 0}%</div>
                  <div className="cf-pdf-expense-row">
                    {/* Pie Chart */}
                    {pieSlices.length > 0 && (
                      <div className="cf-pdf-pie-wrap">
                        <svg viewBox="0 0 150 150" className="cf-pdf-pie-svg">
                          {pieSlices.map((s, i) => (
                            <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5" />
                          ))}
                        </svg>
                      </div>
                    )}
                    {/* Table */}
                    <div className="cf-pdf-expense-detail">
                      <table className="cf-pdf-table">
                        <thead>
                          <tr><th></th><th>Supplier</th><th>Amount (USD)</th><th>Share</th></tr>
                        </thead>
                        <tbody>
                          {expenseBySupplier.map(([name, amt], idx) => (
                            <tr key={idx}>
                              <td><span className="cf-pdf-pie-dot" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}></span></td>
                              <td>{name}</td>
                              <td style={{ textAlign: 'right' }}>{fmtUSD(amt)}</td>
                              <td style={{ textAlign: 'center' }}>{(amt / totalExpenseUSD * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                          <tr className="cf-pdf-total-row">
                            <td></td>
                            <td><strong>Total</strong></td>
                            <td style={{ textAlign: 'right' }}><strong>{fmtUSD(totalExpenseUSD)}</strong></td>
                            <td style={{ textAlign: 'center' }}><strong>100%</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Purchase Detail Table */}
                <div className="cf-pdf-section">
                  <div className="cf-pdf-section-title cf-pdf-st-expense">각 발주 품목 Payment Terms</div>
                  {purchaseExpenses.length > 0 ? (
                    <table className="cf-pdf-table">
                      <thead>
                        <tr><th>품목</th><th>공급업체</th><th>구분</th><th>비율</th><th>금액 (USD)</th><th>예정 지급일</th><th>집행</th></tr>
                      </thead>
                      <tbody>
                        {purchaseExpenses.map((e, idx) => (
                          <tr key={idx} className={e.paid ? 'cf-pdf-row-done' : ''}>
                            <td>{e.partName}</td>
                            <td>{e.supplier}</td>
                            <td>{e.termLabel}</td>
                            <td style={{ textAlign: 'center' }}>{e.percentage}%</td>
                            <td style={{ textAlign: 'right' }}>{fmtUSD(e.amountUSD)}</td>
                            <td style={{ textAlign: 'center' }}>{e.expectedPaymentDate || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{e.paid ? 'Done' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="cf-pdf-empty">No purchase expenses</div>}
                </div>
              </div>
            </div>

            {/* Flow Diagram */}
            <div className="cf-pdf-flow">
              <div className="cf-pdf-flow-box cf-pdf-flow-contract">
                <div className="cf-pdf-flow-label">Contract</div>
                <div className="cf-pdf-flow-value">{fmtUSD(contractUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-terms">
                <div className="cf-pdf-flow-label">P/T</div>
                <div className="cf-pdf-flow-value">{paymentTerms.length}건</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-inv">
                <div className="cf-pdf-flow-label">Invoice</div>
                <div className="cf-pdf-flow-value">{fmtUSD(totalInvoicedUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-recv">
                <div className="cf-pdf-flow-label">Received</div>
                <div className="cf-pdf-flow-value">{fmtUSD(totalReceivedUSD)}</div>
              </div>
              <div className="cf-pdf-flow-sep">|</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-purchase">
                <div className="cf-pdf-flow-label">Purchase</div>
                <div className="cf-pdf-flow-value">{purchaseExpenses.length}건</div>
              </div>
              <div className="cf-pdf-flow-arrow">→</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-exp">
                <div className="cf-pdf-flow-label">Expense</div>
                <div className="cf-pdf-flow-value">{fmtUSD(totalExpenseUSD)}</div>
              </div>
              <div className="cf-pdf-flow-arrow">=</div>
              <div className="cf-pdf-flow-box cf-pdf-flow-net" style={{ borderColor: (totalReceivedUSD - totalPaidUSD) >= 0 ? '#10b981' : '#ef4444' }}>
                <div className="cf-pdf-flow-label">Net Balance</div>
                <div className="cf-pdf-flow-value" style={{ color: (totalReceivedUSD - totalPaidUSD) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtUSD(totalReceivedUSD - totalPaidUSD)}
                </div>
              </div>
            </div>
          </div>

          {/* Page separator */}
          <div className="cf-pdf-page-separator">— Page 2: Monthly Cash Flow Detail —</div>

          {/* ========== PAGE 2: Monthly Detail with items ========== */}
          <div ref={page2Ref} className="cf-pdf-page cf-pdf-page2">
            {/* Header */}
            <div className="cf-pdf-header">
              <div className="cf-pdf-header-left">
                <div className="cf-pdf-title">{project.name || 'Project'}</div>
                <div className="cf-pdf-subtitle">Monthly Cash Flow Detail ({cumulativeData.length}개월)</div>
              </div>
              <div className="cf-pdf-header-right">
                <div className="cf-pdf-meta">Project No. {project.projectNo || '-'}</div>
                <div className="cf-pdf-meta">Date: {now.toISOString().split('T')[0]}</div>
              </div>
            </div>

            {/* Monthly Detail Table - ALL months, full amounts, with item details */}
            {cumulativeData.length > 0 && (
              <div className="cf-pdf-p2-monthly">
                <table className="cf-pdf-table cf-pdf-p2-table">
                  <thead>
                    <tr>
                      <th className="cf-pdf-p2-month-th">Month</th>
                      <th className="cf-pdf-p2-detail-th">수금 항목 (Income Details)</th>
                      <th className="cf-pdf-p2-amt-th">수금액</th>
                      <th className="cf-pdf-p2-detail-th">지출 항목 (Expense Details)</th>
                      <th className="cf-pdf-p2-amt-th">지출액</th>
                      <th className="cf-pdf-p2-amt-th">누적수금</th>
                      <th className="cf-pdf-p2-amt-th">누적지출</th>
                      <th className="cf-pdf-p2-amt-th">예상잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumulativeData.map(d => {
                      const items = getMonthItems(d.key);
                      const income = d.expectedIncome + d.actualIncome;
                      const expense = d.expectedExpense + d.actualExpense;
                      const isCurrent = d.key === currentMonthKey;

                      // Build income detail lines
                      const incomeLines: { label: string; amount: number; type: string }[] = [];
                      items.incExpected.forEach(inv => {
                        const term = paymentTerms.find(t => t.id === inv.paymentTermId);
                        incomeLines.push({ label: `[예상] ${term ? term.milestone : inv.invoiceNo || 'Invoice'}`, amount: inv.amountUSD, type: 'expected' });
                      });
                      items.incReceived.forEach(inv => {
                        const term = paymentTerms.find(t => t.id === inv.paymentTermId);
                        incomeLines.push({ label: `[실수금] ${term ? term.milestone : inv.invoiceNo || 'Invoice'}`, amount: inv.receivedAmount, type: 'actual' });
                      });

                      // Build expense detail lines
                      const expenseLines: { label: string; amount: number; type: string }[] = [];
                      items.expExpected.forEach(e => {
                        expenseLines.push({ label: `[예상] ${e.partName} (${e.termLabel})`, amount: e.amountUSD, type: 'expected' });
                      });
                      items.expPaid.forEach(e => {
                        expenseLines.push({ label: `[집행] ${e.partName} (${e.termLabel})`, amount: e.amountUSD, type: 'actual' });
                      });

                      return (
                        <tr key={d.key} className={isCurrent ? 'cf-pdf-p2-current' : ''}>
                          <td className="cf-pdf-p2-month">{d.label}</td>
                          <td className="cf-pdf-p2-items">
                            {incomeLines.length > 0 ? incomeLines.map((l, i) => (
                              <div key={i} className={`cf-pdf-p2-item ${l.type === 'actual' ? 'cf-pdf-p2-item-actual' : ''}`}>
                                <span className="cf-pdf-p2-item-name">{l.label}</span>
                                <span className="cf-pdf-p2-item-amt">{fmtUSD(l.amount)}</span>
                              </div>
                            )) : <span className="cf-pdf-p2-dash">-</span>}
                          </td>
                          <td className="cf-pdf-p2-income-total">{income > 0 ? fmtUSD(income) : '-'}</td>
                          <td className="cf-pdf-p2-items">
                            {expenseLines.length > 0 ? expenseLines.map((l, i) => (
                              <div key={i} className={`cf-pdf-p2-item ${l.type === 'actual' ? 'cf-pdf-p2-item-actual' : ''}`}>
                                <span className="cf-pdf-p2-item-name">{l.label}</span>
                                <span className="cf-pdf-p2-item-amt">{fmtUSD(l.amount)}</span>
                              </div>
                            )) : <span className="cf-pdf-p2-dash">-</span>}
                          </td>
                          <td className="cf-pdf-p2-expense-total">{expense > 0 ? fmtUSD(expense) : '-'}</td>
                          <td className="cf-pdf-p2-cum-inc">{fmtUSD(d.cumExpInc + d.cumActInc)}</td>
                          <td className="cf-pdf-p2-cum-exp">{fmtUSD(d.cumExpExp)}</td>
                          <td className="cf-pdf-p2-balance" style={{ color: d.expectedBalance >= 0 ? '#10b981' : '#ef4444' }}>
                            {fmtUSD(d.expectedBalance)}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals */}
                    <tr className="cf-pdf-p2-total">
                      <td><strong>TOTAL</strong></td>
                      <td></td>
                      <td className="cf-pdf-p2-income-total"><strong>{fmtUSD(cumulativeData.reduce((s, d) => s + d.expectedIncome + d.actualIncome, 0))}</strong></td>
                      <td></td>
                      <td className="cf-pdf-p2-expense-total"><strong>{fmtUSD(cumulativeData.reduce((s, d) => s + d.expectedExpense + d.actualExpense, 0))}</strong></td>
                      <td></td>
                      <td></td>
                      <td className="cf-pdf-p2-balance" style={{
                        fontWeight: 800,
                        color: cumulativeData.length > 0 && cumulativeData[cumulativeData.length - 1].expectedBalance >= 0 ? '#10b981' : '#ef4444'
                      }}>
                        <strong>{cumulativeData.length > 0 ? fmtUSD(cumulativeData[cumulativeData.length - 1].expectedBalance) : '-'}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
