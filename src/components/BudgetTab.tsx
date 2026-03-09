import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Project, BudgetItem, BudgetPart, QuotationCurrency } from '../types';
import { useProjects } from '../context/ProjectContext';
import EditableCell from './EditableCell';

interface BudgetTabProps {
  project: Project;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtUSD(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

function fmtKRW(n: number): string {
  return '\u20A9' + Math.round(n).toLocaleString();
}

function fmtRate(n: number): string {
  if (n === 0) return '-';
  return (n * 100).toFixed(1) + '%';
}

const PART_LABELS: Record<BudgetPart, string> = { PE: 'PE PART', IC: 'I&C PART' };

function createEmptyBudgetItem(part: BudgetPart, category: BudgetItem['category'], sortOrder: number): Omit<BudgetItem, 'id'> {
  return {
    part, category, name: '', originalBudgetUSD: 0, originalBudgetKRW: 0,
    quotationPrice: 0, quotationCurrency: 'KRW', quotationOriginalPrice: 0,
    revisedBudget: 0, supplier: '', rfqDate: '', rfqIssued: false,
    poDate: '', poIssued: false, expectedDelivery: '', requiredDelivery: '', remark: '',
    quoteStatus: 'assumed', sortOrder, groupId: '',
  };
}

// Generate a simple unique group id
let groupCounter = 0;
function newGroupId() {
  return 'grp_' + Date.now() + '_' + (++groupCounter);
}

export default function BudgetTab({ project }: BudgetTabProps) {
  const { updateProject, addBudgetItem, updateBudgetItem, deleteBudgetItem, reorderBudgetItems } = useProjects();
  const [collapsedParts, setCollapsedParts] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drag state
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  // Scrollbar sync refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1400);

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const updateWidth = () => setTableScrollWidth(wrapper.scrollWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const top = topScrollRef.current;
    const wrapper = tableWrapperRef.current;
    if (!top || !wrapper) return;
    let syncing = false;
    const onTopScroll = () => {
      if (syncing) return;
      syncing = true;
      wrapper.scrollLeft = top.scrollLeft;
      syncing = false;
    };
    const onWrapperScroll = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = wrapper.scrollLeft;
      syncing = false;
    };
    top.addEventListener('scroll', onTopScroll);
    wrapper.addEventListener('scroll', onWrapperScroll);
    return () => {
      top.removeEventListener('scroll', onTopScroll);
      wrapper.removeEventListener('scroll', onWrapperScroll);
    };
  }, []);

  const exchangeRate = project.exchangeRate || 1350;
  const eurExchangeRate = project.eurExchangeRate || 1500;

  const convertToKRW = useCallback((amount: number, currency: QuotationCurrency) => {
    switch (currency) {
      case 'USD': return Math.round(amount * exchangeRate);
      case 'EUR': return Math.round(amount * eurExchangeRate);
      default: return amount;
    }
  }, [exchangeRate, eurExchangeRate]);
  const budgetItems = useMemo(() =>
    [...(project.budgetItems || [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [project.budgetItems]
  );

  const peItems = useMemo(() => budgetItems.filter(i => i.part === 'PE'), [budgetItems]);
  const icItems = useMemo(() => budgetItems.filter(i => i.part === 'IC'), [budgetItems]);

  // Group info: for each sorted list of items, compute which items start a group and span count
  const buildGroupInfo = useCallback((items: BudgetItem[]) => {
    const info: Record<string, { isFirst: boolean; span: number }> = {};
    const grouped: Record<string, BudgetItem[]> = {};
    for (const item of items) {
      if (item.groupId) {
        if (!grouped[item.groupId]) grouped[item.groupId] = [];
        grouped[item.groupId].push(item);
      }
    }
    for (const item of items) {
      if (item.groupId && grouped[item.groupId] && grouped[item.groupId].length > 1) {
        const group = grouped[item.groupId];
        const isFirst = group[0].id === item.id;
        info[item.id] = { isFirst, span: isFirst ? group.length : 0 };
      }
    }
    return info;
  }, []);

  // Auto-calculations
  const calcOriginalKRW = (item: BudgetItem) => item.originalBudgetUSD * exchangeRate;
  const calcExecutionRate = (item: BudgetItem) => item.revisedBudget > 0 ? item.quotationPrice / item.revisedBudget : 0;
  const calcAmountChange = (item: BudgetItem) => {
    const origKRW = item.originalBudgetKRW || calcOriginalKRW(item);
    return origKRW - item.revisedBudget;
  };

  const calcSubTotal = (items: BudgetItem[]) => {
    const origUSD = items.reduce((s, i) => s + i.originalBudgetUSD, 0);
    const origKRW = items.reduce((s, i) => s + (i.originalBudgetKRW || calcOriginalKRW(i)), 0);
    const quotation = items.reduce((s, i) => s + i.quotationPrice, 0);
    const revised = items.reduce((s, i) => s + i.revisedBudget, 0);
    const change = items.reduce((s, i) => s + calcAmountChange(i), 0);
    return { origUSD, origKRW, quotation, revised, change };
  };

  const peTotal = calcSubTotal(peItems);
  const icTotal = calcSubTotal(icItems);
  const grandTotal = {
    origUSD: peTotal.origUSD + icTotal.origUSD,
    origKRW: peTotal.origKRW + icTotal.origKRW,
    quotation: peTotal.quotation + icTotal.quotation,
    revised: peTotal.revised + icTotal.revised,
    change: peTotal.change + icTotal.change,
  };

  // Contract & GM
  const initialContract = project.initialContractAmount || 0;
  const initialContractUSD = project.initialContractAmountUSD || 0;
  const updatedContract = project.updatedContractAmount || 0;
  const updatedContractUSD = project.updatedContractAmountUSD || 0;
  const totalBudget = grandTotal.origKRW;
  const totalRevised = grandTotal.revised;
  const initialGM = initialContract > 0 ? (initialContract - totalBudget) / initialContract : 0;
  const expectedGM1 = updatedContract > 0 ? (updatedContract - totalRevised) / updatedContract : 0;
  const surplusFromExecution = budgetItems
    .filter(i => i.category === 'item' && calcExecutionRate(i) > 0 && calcExecutionRate(i) < 1)
    .reduce((s, i) => s + (i.revisedBudget - i.quotationPrice), 0);
  const expectedGM2 = updatedContract > 0 ? (updatedContract - totalRevised + surplusFromExecution) / updatedContract : 0;

  // Target GM & Available Budget calculation
  const targetGM = project.targetGM || 0;
  const contractForCalc = updatedContract > 0 ? updatedContract : initialContract;
  const availableBudget = contractForCalc > 0 ? contractForCalc * (1 - targetGM / 100) : 0;
  const remainingBudget = availableBudget - totalRevised;

  const togglePart = (part: string) => {
    setCollapsedParts(prev => ({ ...prev, [part]: !prev[part] }));
  };

  const handleAddItem = (part: BudgetPart, category: BudgetItem['category'] = 'item') => {
    const partItems = budgetItems.filter(i => i.part === part);
    const maxOrder = partItems.length > 0 ? Math.max(...partItems.map(i => i.sortOrder)) : 0;
    addBudgetItem(project.id, createEmptyBudgetItem(part, category, maxOrder + 1));
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  const handleDeleteItem = (itemId: string) => {
    deleteBudgetItem(project.id, itemId);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
  };

  const handleDelete = () => {
    if (contextMenu) {
      deleteBudgetItem(project.id, contextMenu.itemId);
      setContextMenu(null);
    }
  };

  const handleDragStart = (id: string) => {
    dragId.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverId.current = id;
  };

  const handleDrop = (part: BudgetPart) => {
    if (!dragId.current || !dragOverId.current || dragId.current === dragOverId.current) return;
    const partItems = budgetItems.filter(i => i.part === part);
    const ids = partItems.map(i => i.id);
    const fromIdx = ids.indexOf(dragId.current);
    const toIdx = ids.indexOf(dragOverId.current);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId.current);
    const otherItems = budgetItems.filter(i => i.part !== part).map(i => i.id);
    reorderBudgetItems(project.id, [...(part === 'PE' ? ids : otherItems), ...(part === 'PE' ? otherItems : ids)]);
    dragId.current = null;
    dragOverId.current = null;
  };

  // Merge selected items
  const handleMerge = () => {
    if (selectedIds.size < 2) return;
    const ids = Array.from(selectedIds);
    // Check all are same part
    const items = ids.map(id => budgetItems.find(i => i.id === id)).filter(Boolean) as BudgetItem[];
    const parts = new Set(items.map(i => i.part));
    if (parts.size > 1) return; // Can't merge across parts
    const gid = newGroupId();
    for (const id of ids) {
      updateBudgetItem(project.id, id, { groupId: gid });
    }
    setSelectedIds(new Set());
  };

  // Unmerge a group
  const handleUnmerge = (groupId: string) => {
    const items = budgetItems.filter(i => i.groupId === groupId);
    for (const item of items) {
      updateBudgetItem(project.id, item.id, { groupId: '' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Exchange rate conversion helpers
  const handleInitialContractKRW = (v: string) => {
    const krw = Number(v) || 0;
    updateProject(project.id, {
      initialContractAmount: krw,
      initialContractAmountUSD: exchangeRate > 0 ? Math.round(krw / exchangeRate) : 0,
    });
  };

  const handleInitialContractUSD = (v: string) => {
    const usd = Number(v) || 0;
    updateProject(project.id, {
      initialContractAmountUSD: usd,
      initialContractAmount: Math.round(usd * exchangeRate),
    });
  };

  const handleUpdatedContractKRW = (v: string) => {
    const krw = Number(v) || 0;
    updateProject(project.id, {
      updatedContractAmount: krw,
      updatedContractAmountUSD: exchangeRate > 0 ? Math.round(krw / exchangeRate) : 0,
    });
  };

  const handleUpdatedContractUSD = (v: string) => {
    const usd = Number(v) || 0;
    updateProject(project.id, {
      updatedContractAmountUSD: usd,
      updatedContractAmount: Math.round(usd * exchangeRate),
    });
  };

  const quoteStatusOptions = [
    { value: 'assumed', label: '가정 (PP12)' },
    { value: 'quoting', label: '견적 진행중' },
    { value: 'confirmed', label: '확정 (FINAL)' },
  ];

  const quoteStatusColor = (status: string) => {
    switch (status) {
      case 'assumed': return '#dcfce7';
      case 'quoting': return '#fef9c3';
      case 'confirmed': return '#dbeafe';
      default: return 'transparent';
    }
  };

  // Compute group-level aggregated values for merged display
  const getGroupTotals = useCallback((groupId: string) => {
    const groupItems = budgetItems.filter(i => i.groupId === groupId);
    const totalQuotation = groupItems.reduce((s, i) => s + i.quotationPrice, 0);
    const totalRevised = groupItems.reduce((s, i) => s + i.revisedBudget, 0);
    const totalOrigKRW = groupItems.reduce((s, i) => s + (i.originalBudgetKRW || i.originalBudgetUSD * exchangeRate), 0);
    const execRate = totalRevised > 0 ? totalQuotation / totalRevised : 0;
    const amtChange = totalOrigKRW - totalRevised;
    return { totalQuotation, totalRevised, execRate, amtChange, totalOrigKRW };
  }, [budgetItems, exchangeRate]);

  const renderRow = (item: BudgetItem, part: BudgetPart, groupInfo: Record<string, { isFirst: boolean; span: number }>) => {
    const origKRW = item.originalBudgetKRW || calcOriginalKRW(item);
    const execRate = calcExecutionRate(item);
    const amtChange = calcAmountChange(item);
    const isEngOrCost = item.category !== 'item';
    const gi = groupInfo[item.id];
    const inGroup = !!gi;
    const isGroupFirst = gi?.isFirst ?? false;
    const span = gi?.span ?? 1;
    // If in group but not first, skip merged cells
    const skipMergedCells = inGroup && !isGroupFirst;

    const isSelected = selectedIds.has(item.id);

    // For merged groups, use group totals for display
    const groupTotals = inGroup ? getGroupTotals(item.groupId) : null;
    const displayExecRate = inGroup && isGroupFirst ? (groupTotals?.execRate ?? 0) : execRate;
    const displayAmtChange = inGroup && isGroupFirst ? (groupTotals?.amtChange ?? 0) : amtChange;

    // Execution rate color: 90% threshold
    const rateForColor = inGroup && isGroupFirst ? displayExecRate : execRate;
    const execRateClass = isEngOrCost ? 'budget-cell-dash' :
      rateForColor >= 0.9 ? 'budget-exec-over' :
      rateForColor > 0 ? 'budget-exec-under' : '';

    return (
      <tr
        key={item.id}
        className={`budget-row ${isSelected ? 'budget-row-selected' : ''} ${inGroup ? 'budget-row-grouped' : ''}`}
        draggable
        onDragStart={() => handleDragStart(item.id)}
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDrop={() => handleDrop(part)}
        onContextMenu={(e) => handleContextMenu(e, item.id)}
        style={{ backgroundColor: isSelected ? '#e0e7ff' : quoteStatusColor(item.quoteStatus) }}
      >
        <td className="budget-cell budget-cell-select">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(item.id)}
            className="budget-select-checkbox"
          />
        </td>
        <td className="budget-cell budget-drag-handle">&#x2807;</td>
        <td className="budget-cell budget-cell-name">
          <EditableCell value={item.name} type="multiline" onSave={v => updateBudgetItem(project.id, item.id, { name: v })} placeholder="품목명 입력" />
        </td>
        <td className="budget-cell budget-cell-num">
          <EditableCell value={String(item.originalBudgetUSD || '')} type="number" onSave={v => {
            const usd = Number(v) || 0;
            updateBudgetItem(project.id, item.id, { originalBudgetUSD: usd, originalBudgetKRW: usd * exchangeRate });
          }} placeholder="-" />
        </td>
        <td className="budget-cell budget-cell-num budget-cell-auto">{item.originalBudgetUSD > 0 ? fmt(origKRW) : '-'}</td>
        {/* Merged columns: 견적가, 수정예산, 실행율, 금액증감, 견적업체 */}
        {!skipMergedCells && (
          <td className={`budget-cell budget-cell-num budget-cell-quote ${inGroup ? 'budget-cell-merged' : ''}`} rowSpan={inGroup ? span : undefined}>
            <div className="budget-quote-input">
              <select
                className="budget-currency-select"
                value={item.quotationCurrency || 'KRW'}
                onChange={e => {
                  const newCurrency = e.target.value as QuotationCurrency;
                  const origPrice = item.quotationOriginalPrice || item.quotationPrice;
                  // When switching currency, keep originalPrice and recalculate KRW
                  updateBudgetItem(project.id, item.id, {
                    quotationCurrency: newCurrency,
                    quotationOriginalPrice: origPrice,
                    quotationPrice: convertToKRW(origPrice, newCurrency),
                  });
                }}
              >
                <option value="KRW">₩</option>
                <option value="USD">$</option>
                <option value="EUR">€</option>
              </select>
              <EditableCell
                value={String((item.quotationCurrency && item.quotationCurrency !== 'KRW' ? item.quotationOriginalPrice : item.quotationPrice) || '')}
                type="number"
                onSave={v => {
                  const val = Number(v) || 0;
                  const currency = item.quotationCurrency || 'KRW';
                  if (currency === 'KRW') {
                    updateBudgetItem(project.id, item.id, { quotationPrice: val, quotationOriginalPrice: val });
                  } else {
                    updateBudgetItem(project.id, item.id, {
                      quotationOriginalPrice: val,
                      quotationPrice: convertToKRW(val, currency),
                    });
                  }
                }}
                placeholder="-"
              />
            </div>
            {item.quotationCurrency && item.quotationCurrency !== 'KRW' && item.quotationPrice > 0 && (
              <div className="budget-converted-krw">≈ ₩{fmt(item.quotationPrice)}</div>
            )}
          </td>
        )}
        {!skipMergedCells && (
          <td className={`budget-cell budget-cell-num ${inGroup ? 'budget-cell-merged' : ''}`} rowSpan={inGroup ? span : undefined}>
            <EditableCell value={String(item.revisedBudget || '')} type="number" onSave={v => updateBudgetItem(project.id, item.id, { revisedBudget: Number(v) || 0 })} placeholder="-" />
          </td>
        )}
        {!skipMergedCells && (
          <td className={`budget-cell budget-cell-num budget-exec-rate ${execRateClass} ${inGroup ? 'budget-cell-merged' : ''}`} rowSpan={inGroup ? span : undefined}>
            {isEngOrCost ? '-' : fmtRate(displayExecRate)}
          </td>
        )}
        {!skipMergedCells && (
          <td className={`budget-cell budget-cell-num budget-cell-auto ${inGroup ? 'budget-cell-merged' : ''} ${displayAmtChange < 0 ? 'budget-cell-negative' : displayAmtChange > 0 ? 'budget-cell-positive' : ''}`} rowSpan={inGroup ? span : undefined}>
            {(inGroup ? (groupTotals?.totalOrigKRW ?? 0) > 0 || (groupTotals?.totalRevised ?? 0) > 0 : item.revisedBudget > 0 || origKRW > 0) ? fmt(displayAmtChange) : '-'}
          </td>
        )}
        {!skipMergedCells && (
          <td className={`budget-cell budget-cell-supplier ${inGroup ? 'budget-cell-merged' : ''}`} rowSpan={inGroup ? span : undefined}>
            <EditableCell value={item.supplier} onSave={v => updateBudgetItem(project.id, item.id, { supplier: v })} placeholder="-" />
          </td>
        )}
        <td className="budget-cell budget-cell-sm">
          <div className="budget-rfq-cell">
            <label className="budget-checkbox-label">
              <input type="checkbox" checked={item.rfqIssued} onChange={e => updateBudgetItem(project.id, item.id, { rfqIssued: e.target.checked })} />
              {item.rfqIssued ? 'YES' : 'NO'}
            </label>
            {item.rfqIssued && (
              <EditableCell value={item.rfqDate} type="date" onSave={v => updateBudgetItem(project.id, item.id, { rfqDate: v })} placeholder="날짜" />
            )}
          </div>
        </td>
        <td className="budget-cell budget-cell-sm">
          <div className="budget-rfq-cell">
            <label className="budget-checkbox-label">
              <input type="checkbox" checked={item.poIssued} onChange={e => updateBudgetItem(project.id, item.id, { poIssued: e.target.checked })} />
              {item.poIssued ? 'YES' : 'NO'}
            </label>
            {item.poIssued && (
              <EditableCell value={item.poDate} type="date" onSave={v => updateBudgetItem(project.id, item.id, { poDate: v })} placeholder="날짜" />
            )}
          </div>
        </td>
        <td className="budget-cell budget-cell-sm">
          <EditableCell value={item.expectedDelivery} onSave={v => updateBudgetItem(project.id, item.id, { expectedDelivery: v })} placeholder="-" />
        </td>
        <td className="budget-cell budget-cell-sm">
          <EditableCell value={item.requiredDelivery} onSave={v => updateBudgetItem(project.id, item.id, { requiredDelivery: v })} placeholder="-" />
        </td>
        <td className="budget-cell">
          <EditableCell
            value={item.quoteStatus}
            type="select"
            options={quoteStatusOptions}
            onSave={v => updateBudgetItem(project.id, item.id, { quoteStatus: v as BudgetItem['quoteStatus'] })}
          />
        </td>
        <td className="budget-cell">
          <EditableCell value={item.remark} onSave={v => updateBudgetItem(project.id, item.id, { remark: v })} placeholder="-" />
        </td>
        <td className="budget-cell budget-cell-delete">
          {(
            <button
              className="budget-delete-btn"
              onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
              title="삭제"
            >
              &times;
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderSubTotalRow = (label: string, totals: ReturnType<typeof calcSubTotal>, className: string = '') => (
    <tr className={`budget-subtotal-row ${className}`}>
      <td className="budget-cell"></td>
      <td className="budget-cell"></td>
      <td className="budget-cell budget-cell-name budget-subtotal-label">{label}</td>
      <td className="budget-cell budget-cell-num">{fmt(totals.origUSD)}</td>
      <td className="budget-cell budget-cell-num">{fmt(totals.origKRW)}</td>
      <td className="budget-cell budget-cell-num">{fmt(totals.quotation)}</td>
      <td className="budget-cell budget-cell-num">{fmt(totals.revised)}</td>
      <td className="budget-cell budget-cell-num">-</td>
      <td className={`budget-cell budget-cell-num ${totals.change < 0 ? 'budget-cell-negative' : 'budget-cell-positive'}`}>{fmt(totals.change)}</td>
      <td colSpan={8} className="budget-cell"></td>
    </tr>
  );

  const renderPartSection = (part: BudgetPart, items: BudgetItem[], totals: ReturnType<typeof calcSubTotal>) => {
    const isCollapsed = collapsedParts[part];
    const regularItems = items.filter(i => i.category === 'item');
    const engineeringItems = items.filter(i => i.category === 'engineering');
    const directCostItems = items.filter(i => i.category === 'direct_cost');
    const contingencyItems = items.filter(i => i.category === 'contingency');
    const groupInfo = buildGroupInfo(items);

    return (
      <>
        <tr className="budget-part-header" onClick={() => togglePart(part)}>
          <td colSpan={17} className="budget-cell">
            <span className="budget-part-toggle">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
            <strong>{PART_LABELS[part]}</strong>
            <span className="budget-part-summary">({items.length}개 항목 | 수정예산: {fmt(totals.revised)} 원)</span>
          </td>
        </tr>
        {!isCollapsed && (
          <>
            {regularItems.map(item => renderRow(item, part, groupInfo))}
            {engineeringItems.length > 0 && (
              <tr className="budget-category-header">
                <td colSpan={17} className="budget-cell budget-category-label">Engineering Hours</td>
              </tr>
            )}
            {engineeringItems.map(item => renderRow(item, part, groupInfo))}
            {directCostItems.map(item => renderRow(item, part, groupInfo))}
            {contingencyItems.map(item => renderRow(item, part, groupInfo))}
            <tr className="budget-add-row">
              <td colSpan={17} className="budget-cell">
                <div className="budget-add-buttons">
                  <button className="budget-add-btn" onClick={() => handleAddItem(part, 'item')}>+ 품목 추가</button>
                  <button className="budget-add-btn" onClick={() => handleAddItem(part, 'engineering')}>+ Engineering</button>
                  <button className="budget-add-btn" onClick={() => handleAddItem(part, 'direct_cost')}>+ Direct Cost</button>
                  <button className="budget-add-btn" onClick={() => handleAddItem(part, 'contingency')}>+ Contingency</button>
                </div>
              </td>
            </tr>
            {renderSubTotalRow(`SUB-TOTAL (${PART_LABELS[part]})`, totals)}
          </>
        )}
      </>
    );
  };

  return (
    <div className="budget-tab" onClick={() => setContextMenu(null)}>
      {/* Contract & GM Summary Cards */}
      <div className="budget-summary-section">
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">환율 (USD/KRW)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(exchangeRate)} type="number" onSave={v => updateProject(project.id, { exchangeRate: Number(v) })} />
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">환율 (EUR/KRW)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(eurExchangeRate)} type="number" onSave={v => updateProject(project.id, { eurExchangeRate: Number(v) })} />
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Initial Contract Amount (KRW)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(initialContract || '')} type="number" onSave={handleInitialContractKRW} />
            </div>
            <div className="summary-sub-value">{initialContractUSD > 0 ? fmtUSD(initialContractUSD) : '-'}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Initial Contract Amount (USD)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(initialContractUSD || '')} type="number" onSave={handleInitialContractUSD} />
            </div>
            <div className="summary-sub-value">{initialContract > 0 ? fmtKRW(initialContract) : '-'}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Updated Contract (KRW)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(updatedContract || '')} type="number" onSave={handleUpdatedContractKRW} />
            </div>
            <div className="summary-sub-value">{updatedContractUSD > 0 ? fmtUSD(updatedContractUSD) : '-'}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Updated Contract (USD)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(updatedContractUSD || '')} type="number" onSave={handleUpdatedContractUSD} />
            </div>
            <div className="summary-sub-value">{updatedContract > 0 ? fmtKRW(updatedContract) : '-'}</div>
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card card-ordered">
            <div className="summary-label">Total Budget</div>
            <div className="summary-value summary-value-sm">{fmtKRW(totalBudget)}</div>
          </div>
          <div className="summary-card card-shipped">
            <div className="summary-label">수정 예산 합계</div>
            <div className="summary-value summary-value-sm">{fmtKRW(totalRevised)}</div>
          </div>
          <div className="summary-card card-pending">
            <div className="summary-label">Initial GM</div>
            <div className="summary-value summary-value-sm">{(initialGM * 100).toFixed(2)}%</div>
          </div>
          <div className={`summary-card ${expectedGM1 >= 0.15 ? 'card-delivered' : 'card-cost'}`}>
            <div className="summary-label">Expected GM (미반영)</div>
            <div className="summary-value summary-value-sm">{(expectedGM1 * 100).toFixed(2)}%</div>
          </div>
          <div className={`summary-card ${expectedGM2 >= 0.15 ? 'card-delivered' : 'card-cost'}`}>
            <div className="summary-label">Expected GM (반영)</div>
            <div className="summary-value summary-value-sm">{(expectedGM2 * 100).toFixed(2)}%</div>
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="summary-label">Target GM (%)</div>
            <div className="summary-value summary-value-sm">
              <EditableCell value={String(targetGM || '')} type="number" onSave={v => updateProject(project.id, { targetGM: Number(v) || 0 })} placeholder="0" />
            </div>
          </div>
          <div className="summary-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="summary-label">사용 가능 예산 (Target GM 기준)</div>
            <div className="summary-value summary-value-sm">{fmtKRW(availableBudget)}</div>
            <div className="summary-sub-value">{fmtUSD(availableBudget / exchangeRate)}</div>
          </div>
          <div className={`summary-card ${remainingBudget >= 0 ? 'card-delivered' : 'card-cost'}`} style={{ borderLeft: `4px solid ${remainingBudget >= 0 ? '#10b981' : '#ef4444'}` }}>
            <div className="summary-label">잔여 예산 (가용 - 수정예산)</div>
            <div className="summary-value summary-value-sm" style={{ color: remainingBudget >= 0 ? '#059669' : '#dc2626' }}>{fmtKRW(remainingBudget)}</div>
            <div className="summary-sub-value">{fmtUSD(remainingBudget / exchangeRate)}</div>
          </div>
        </div>
      </div>

      {/* Merge toolbar */}
      {selectedIds.size >= 2 && (
        <div className="budget-merge-toolbar">
          <span>{selectedIds.size}개 항목 선택됨</span>
          <button className="budget-merge-btn" onClick={handleMerge}>셀 병합 (견적가/업체 통합)</button>
          <button className="budget-merge-cancel-btn" onClick={() => setSelectedIds(new Set())}>선택 해제</button>
        </div>
      )}

      {/* Legend */}
      <div className="budget-legend">
        <span className="budget-legend-item" style={{ backgroundColor: '#dcfce7' }}>가정 (PP12 참고)</span>
        <span className="budget-legend-item" style={{ backgroundColor: '#fef9c3' }}>견적 &amp; Nego 진행중</span>
        <span className="budget-legend-item" style={{ backgroundColor: '#dbeafe' }}>확정 (FINAL PRICE)</span>
      </div>

      {/* Top scrollbar */}
      <div className="budget-top-scrollbar" ref={topScrollRef}>
        <div style={{ width: tableScrollWidth, height: 1 }} />
      </div>

      {/* Main Budget Table */}
      <div className="budget-table-wrapper" ref={tableWrapperRef}>
        <table className="budget-table">
          <thead>
            <tr>
              <th className="budget-th" style={{ width: 32 }}></th>
              <th className="budget-th" style={{ width: 28 }}></th>
              <th className="budget-th budget-th-name">ITEMS</th>
              <th className="budget-th budget-th-num">기존 예산 (USD)</th>
              <th className="budget-th budget-th-num">기존 예산 (KRW)</th>
              <th className="budget-th budget-th-num">견적가</th>
              <th className="budget-th budget-th-num">수정 예산</th>
              <th className="budget-th budget-th-num">실행율 (%)</th>
              <th className="budget-th budget-th-num">금액 증감</th>
              <th className="budget-th">견적 업체</th>
              <th className="budget-th budget-th-sm">RFQ Issue</th>
              <th className="budget-th budget-th-sm">PO Issue</th>
              <th className="budget-th budget-th-sm">예상 납기</th>
              <th className="budget-th budget-th-sm">요구 입고</th>
              <th className="budget-th">상태</th>
              <th className="budget-th">Remark</th>
              <th className="budget-th" style={{ width: 36 }}>삭제</th>
            </tr>
          </thead>
          <tbody>
            {renderPartSection('PE', peItems, peTotal)}
            {renderPartSection('IC', icItems, icTotal)}
            {renderSubTotalRow('TOTAL', grandTotal, 'budget-grand-total-row')}
          </tbody>
        </table>
      </div>

      {/* Bottom Summary */}
      <div className="budget-bottom-summary">
        <table className="budget-summary-table">
          <tbody>
            <tr>
              <td className="budget-summary-label">Initial Contract Amount</td>
              <td className="budget-summary-val">{fmtKRW(initialContract)}</td>
              <td className="budget-summary-val">{fmtUSD(initialContractUSD)}</td>
            </tr>
            <tr>
              <td className="budget-summary-label">Updated Contract Amount</td>
              <td className="budget-summary-val">{fmtKRW(updatedContract)}</td>
              <td className="budget-summary-val">{fmtUSD(updatedContractUSD)}</td>
            </tr>
            <tr>
              <td className="budget-summary-label">Total Budget</td>
              <td className="budget-summary-val">{fmtKRW(totalBudget)}</td>
              <td className="budget-summary-val">{fmtUSD(totalBudget / exchangeRate)}</td>
            </tr>
            <tr>
              <td className="budget-summary-label">Initial GM</td>
              <td className="budget-summary-val">{(initialGM * 100).toFixed(2)}%</td>
              <td></td>
            </tr>
            <tr>
              <td className="budget-summary-label">Expected GM (실행율 남는 비용 미반영)</td>
              <td className="budget-summary-val">{(expectedGM1 * 100).toFixed(2)}%</td>
              <td></td>
            </tr>
            <tr>
              <td className="budget-summary-label">Expected GM (실행율 남는 비용 반영)</td>
              <td className="budget-summary-val">{(expectedGM2 * 100).toFixed(2)}%</td>
              <td></td>
            </tr>
            {targetGM > 0 && (
              <>
                <tr style={{ borderTop: '2px solid #8b5cf6' }}>
                  <td className="budget-summary-label" style={{ color: '#7c3aed' }}>Target GM</td>
                  <td className="budget-summary-val">{targetGM}%</td>
                  <td></td>
                </tr>
                <tr>
                  <td className="budget-summary-label" style={{ color: '#7c3aed' }}>사용 가능 예산</td>
                  <td className="budget-summary-val">{fmtKRW(availableBudget)}</td>
                  <td className="budget-summary-val">{fmtUSD(availableBudget / exchangeRate)}</td>
                </tr>
                <tr>
                  <td className="budget-summary-label" style={{ color: remainingBudget >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>잔여 예산</td>
                  <td className="budget-summary-val" style={{ color: remainingBudget >= 0 ? '#059669' : '#dc2626' }}>{fmtKRW(remainingBudget)}</td>
                  <td className="budget-summary-val" style={{ color: remainingBudget >= 0 ? '#059669' : '#dc2626' }}>{fmtUSD(remainingBudget / exchangeRate)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (() => {
        const ctxItem = budgetItems.find(i => i.id === contextMenu.itemId);
        const isInGroup = ctxItem && ctxItem.groupId;
        const canMerge = selectedIds.size >= 2;
        return (
          <div className="budget-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <button onClick={handleDelete}>삭제</button>
            <button onClick={() => {
              const item = budgetItems.find(i => i.id === contextMenu.itemId);
              if (item) {
                const newItem = { ...createEmptyBudgetItem(item.part, item.category, item.sortOrder + 0.5), name: '' };
                addBudgetItem(project.id, newItem);
              }
              setContextMenu(null);
            }}>아래에 행 추가</button>
            <div className="budget-context-divider" />
            {canMerge && (
              <button onClick={() => { handleMerge(); setContextMenu(null); }}>셀 병합</button>
            )}
            {isInGroup && (
              <button onClick={() => { handleUnmerge(ctxItem.groupId); setContextMenu(null); }}>병합 해제</button>
            )}
            <button onClick={() => setContextMenu(null)}>취소</button>
          </div>
        );
      })()}
    </div>
  );
}
